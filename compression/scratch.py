"""
From-Scratch LLM Input Compressor
=================================

Implementation based on state-of-the-art research:
- LLMLingua-2: Bidirectional token classification via data distillation
- LongLLMLingua: Query-aware compression with position bias mitigation
- QUITO-X: Information bottleneck + cross-attention for token importance
- IC-Former: Lightweight digest tokens
- TACO-RL: Task-aware compression with RL fine-tuning

Goal: Beat Bear-1's 66% token reduction + 1.1% accuracy gain on LongBench v2

Architecture:
1. Bidirectional Encoder (XLM-RoBERTa or DistilBERT) for token importance
2. Query-aware scoring when question is available
3. Multi-signal fusion: attention + semantic + query relevance
4. Adaptive thresholding based on target compression ratio
"""

import os
import re
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Optional, List, Tuple, Dict
from dataclasses import dataclass
from transformers import (
    AutoTokenizer, 
    AutoModel, 
    AutoModelForTokenClassification,
    DistilBertModel,
    DistilBertTokenizer
)
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import tiktoken


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class CompressorConfig:
    """Configuration for the from-scratch compressor."""
    # Model settings
    encoder_model: str = "distilbert-base-uncased"
    use_query_aware: bool = True
    
    # Scoring weights
    attention_weight: float = 0.4      # Weight for attention-based importance
    semantic_weight: float = 0.3       # Weight for semantic similarity
    query_weight: float = 0.3          # Weight for query relevance (if query provided)
    
    # Compression settings
    target_ratio: float = 0.34         # Keep 34% of tokens (66% reduction)
    min_tokens: int = 50               # Minimum tokens to keep
    hard_threshold: float = 0.0        # Disabled - rely on percentile only
    
    # Advanced settings
    layer_weighting: str = "linear"    # How to weight attention layers: "linear", "exponential", "last"
    preserve_structure: bool = True    # Preserve sentence boundaries
    chunk_size: int = 450              # Max chunk size for long docs (leave room for special tokens)
    
    # Position bias mitigation (from LongLLMLingua)
    use_position_bias: bool = True
    position_boost_start: float = 1.2  # Boost for tokens at start
    position_boost_end: float = 1.1    # Boost for tokens at end


@dataclass  
class CompressionResult:
    """Result from compression."""
    original_text: str
    compressed_text: str
    original_tokens: int
    compressed_tokens: int
    token_scores: np.ndarray
    kept_indices: List[int]
    compression_ratio: float
    
    @property
    def reduction_pct(self) -> float:
        return (1 - self.compression_ratio) * 100


# =============================================================================
# Token Importance Scorer
# =============================================================================

class TokenImportanceScorer:
    """
    Scores token importance using multiple signals:
    1. Attention patterns (which tokens the model attends to)
    2. Semantic similarity (how much each token contributes to meaning)
    3. Query relevance (for query-aware compression)
    
    Based on LLMLingua-2's insight that bidirectional context captures
    dependencies missed by causal models.
    """
    
    def __init__(self, config: CompressorConfig):
        self.config = config
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        
        # Load encoder model
        print(f"Loading encoder: {config.encoder_model}...")
        self.tokenizer = AutoTokenizer.from_pretrained(config.encoder_model)
        self.model = AutoModel.from_pretrained(
            config.encoder_model, 
            output_attentions=True
        ).to(self.device)
        self.model.eval()
        
        # Semantic model for query relevance
        if config.use_query_aware:
            print("Loading semantic model for query-aware scoring...")
            self.semantic_model = SentenceTransformer("all-MiniLM-L6-v2")
        else:
            self.semantic_model = None
        
        # Token counter
        self.tiktoken_encoder = tiktoken.encoding_for_model("gpt-4o-mini")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens using tiktoken (GPT-4 tokenizer)."""
        return len(self.tiktoken_encoder.encode(text, disallowed_special=()))
    
    def _get_attention_scores(self, hidden_states, attentions) -> np.ndarray:
        """
        Extract attention-based importance scores.
        
        We aggregate attention across all layers and heads, with higher
        weight given to later layers (which capture more semantic info).
        """
        # Stack all attention layers: (num_layers, batch, heads, seq, seq)
        attn_stack = torch.stack(attentions).squeeze(1)  # Remove batch dim
        num_layers = attn_stack.shape[0]
        
        # Layer weighting
        if self.config.layer_weighting == "linear":
            weights = torch.linspace(0.3, 1.0, num_layers).to(self.device)
        elif self.config.layer_weighting == "exponential":
            weights = torch.exp(torch.linspace(-1, 0, num_layers)).to(self.device)
        else:  # "last"
            weights = torch.zeros(num_layers).to(self.device)
            weights[-1] = 1.0
        
        # Weight and average: sum over source positions, average over layers and heads
        weights = weights.view(-1, 1, 1, 1)
        weighted_attn = (attn_stack * weights).sum(dim=2)  # Sum over source (attended-to)
        scores = weighted_attn.mean(dim=(0, 1))  # Average over layers and heads
        
        return scores.cpu().numpy()
    
    def _get_semantic_scores(self, hidden_states) -> np.ndarray:
        """
        Compute semantic importance: how much each token contributes to
        the overall sentence meaning.
        
        We measure cosine similarity between each token embedding and
        the mean sentence embedding.
        """
        # Get token embeddings and sentence embedding
        token_embs = hidden_states.squeeze(0).cpu().numpy()  # (seq_len, hidden)
        sent_emb = hidden_states.mean(dim=1).cpu().numpy()   # (1, hidden)
        
        # Cosine similarity
        scores = cosine_similarity(token_embs, sent_emb.reshape(1, -1)).squeeze()
        return scores
    
    def _get_query_scores(self, text: str, query: str, token_texts: List[str]) -> np.ndarray:
        """
        Compute query relevance scores (OPTIMIZED).
        
        Based on LongLLMLingua: tokens more relevant to the query should
        be prioritized for keeping.
        
        Optimization: Use batch encoding and sentence-level scoring instead
        of per-token encoding to reduce from O(n) to O(1) encoder calls.
        """
        if self.semantic_model is None:
            return np.zeros(len(token_texts))
        
        # Get query embedding (single encode call)
        query_emb = self.semantic_model.encode([query], show_progress_bar=False)[0]
        
        # Instead of per-token encoding, score at sentence/phrase level
        # Split text into sentences and batch encode
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if not sentences:
            return np.ones(len(token_texts)) * 0.5
        
        # Batch encode all sentences at once (single call)
        sent_embs = self.semantic_model.encode(sentences, show_progress_bar=False)
        
        # Compute sentence scores
        sent_scores = cosine_similarity(query_emb.reshape(1, -1), sent_embs)[0]
        
        # Map sentence scores back to tokens
        scores = np.zeros(len(token_texts))
        token_idx = 0
        reconstructed = ""
        
        for sent_idx, sent in enumerate(sentences):
            sent_tokens = sent.lower().split()
            # Find how many tokens belong to this sentence (approximate)
            tokens_in_sent = 0
            for tok in token_texts[token_idx:]:
                clean_tok = tok.replace("##", "").lower()
                if clean_tok in reconstructed or len(clean_tok) < 2:
                    tokens_in_sent += 1
                    continue
                reconstructed += " " + tok
                tokens_in_sent += 1
                if len(reconstructed.split()) >= len(sent_tokens):
                    break
            
            # Assign sentence score to all its tokens
            end_idx = min(token_idx + max(tokens_in_sent, 1), len(scores))
            scores[token_idx:end_idx] = sent_scores[sent_idx]
            token_idx = end_idx
            reconstructed = ""
            
            if token_idx >= len(scores):
                break
        
        # Fill remaining tokens with average score
        if token_idx < len(scores):
            scores[token_idx:] = np.mean(sent_scores)
        
        return scores
    
    def _apply_position_bias(self, scores: np.ndarray) -> np.ndarray:
        """
        Apply position bias mitigation from LongLLMLingua.
        
        LLMs have U-shaped attention: they recall best at start and end.
        We boost importance of tokens at these positions.
        """
        n = len(scores)
        if n < 10:
            return scores
        
        # Create position weights (U-shaped)
        position_weights = np.ones(n)
        
        # Boost start (first 10%)
        start_region = int(n * 0.1)
        position_weights[:start_region] = self.config.position_boost_start
        
        # Boost end (last 10%)
        end_region = int(n * 0.9)
        position_weights[end_region:] = self.config.position_boost_end
        
        return scores * position_weights
    
    def score_tokens(
        self, 
        text: str, 
        query: Optional[str] = None
    ) -> Tuple[np.ndarray, List[str], List[int]]:
        """
        Score all tokens in text for importance.
        
        Returns:
            scores: numpy array of importance scores per token
            tokens: list of token strings
            token_ids: list of token IDs
        """
        # Tokenize
        inputs = self.tokenizer(
            text, 
            return_tensors="pt", 
            truncation=True, 
            max_length=self.config.chunk_size
        ).to(self.device)
        
        token_ids = inputs["input_ids"][0].cpu().numpy()
        tokens = self.tokenizer.convert_ids_to_tokens(token_ids)
        
        # Forward pass
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # Get attention and semantic scores
        attn_scores = self._get_attention_scores(outputs.last_hidden_state, outputs.attentions)
        sem_scores = self._get_semantic_scores(outputs.last_hidden_state)
        
        # Normalize scores
        def normalize(x):
            if x.max() == x.min():
                return np.ones_like(x)
            return (x - x.min()) / (x.max() - x.min() + 1e-8)
        
        attn_scores = normalize(attn_scores)
        sem_scores = normalize(sem_scores)
        
        # Combine scores
        if query and self.config.use_query_aware:
            query_scores = self._get_query_scores(text, query, tokens)
            query_scores = normalize(query_scores)
            
            scores = (
                self.config.attention_weight * attn_scores +
                self.config.semantic_weight * sem_scores +
                self.config.query_weight * query_scores
            )
        else:
            # Re-weight without query
            total = self.config.attention_weight + self.config.semantic_weight
            scores = (
                (self.config.attention_weight / total) * attn_scores +
                (self.config.semantic_weight / total) * sem_scores
            )
        
        # Apply position bias
        if self.config.use_position_bias:
            scores = self._apply_position_bias(scores)
        
        # Penalize special tokens and non-content tokens
        special_ids = set(self.tokenizer.all_special_ids)
        for i, (tok, tid) in enumerate(zip(tokens, token_ids)):
            if tid in special_ids:
                scores[i] = 0.0
            elif not re.search(r'[a-zA-Z0-9]', tok):
                scores[i] *= 0.5
            elif tok.startswith("##"):  # Subword continuation
                scores[i] *= 0.8
        
        return normalize(scores), tokens, token_ids.tolist()


# =============================================================================
# Main Compressor
# =============================================================================

class ScratchCompressor:
    """
    From-scratch LLM input compressor.
    
    Designed to beat Bear-1's benchmarks through:
    1. Bidirectional token importance (vs causal perplexity)
    2. Query-aware scoring (vs task-agnostic)
    3. Multi-signal fusion (attention + semantic + query)
    4. Position bias mitigation
    """
    
    def __init__(self, config: Optional[CompressorConfig] = None):
        self.config = config or CompressorConfig()
        self.scorer = TokenImportanceScorer(self.config)
    
    def compress(
        self,
        text: str,
        query: Optional[str] = None,
        target_ratio: Optional[float] = None
    ) -> CompressionResult:
        """
        Compress text by keeping only the most important tokens.
        
        Args:
            text: Input text to compress
            query: Optional query for query-aware compression
            target_ratio: Override config target ratio (0.34 = 66% reduction)
        
        Returns:
            CompressionResult with compressed text and metrics
        """
        target = target_ratio or self.config.target_ratio
        
        # Score tokens
        scores, tokens, token_ids = self.scorer.score_tokens(text, query)
        
        # Determine how many tokens to keep
        orig_tokens = len(tokens)
        keep_count = max(
            self.config.min_tokens,
            int(orig_tokens * target)
        )
        
        # Find threshold score to keep top K tokens
        if keep_count >= orig_tokens:
            threshold = 0.0
        else:
            sorted_scores = np.sort(scores)[::-1]
            threshold = max(sorted_scores[keep_count - 1], self.config.hard_threshold)
        
        # Select tokens above threshold
        kept_indices = [i for i, s in enumerate(scores) if s >= threshold]
        
        # Build compressed text
        kept_tokens = [tokens[i] for i in kept_indices]
        compressed = self.scorer.tokenizer.convert_tokens_to_string(kept_tokens)
        
        # Clean up
        compressed = re.sub(r'\s+', ' ', compressed).strip()
        
        # Calculate actual compression
        comp_tokens = self.scorer.count_tokens(compressed)
        orig_count = self.scorer.count_tokens(text)
        
        return CompressionResult(
            original_text=text,
            compressed_text=compressed,
            original_tokens=orig_count,
            compressed_tokens=comp_tokens,
            token_scores=scores,
            kept_indices=kept_indices,
            compression_ratio=comp_tokens / orig_count if orig_count > 0 else 1.0
        )
    
    def compress_chunks(
        self,
        text: str,
        query: Optional[str] = None,
        target_ratio: Optional[float] = None
    ) -> CompressionResult:
        """
        Compress long text by processing in chunks.
        
        For texts longer than chunk_size, we:
        1. Split into chunks at sentence boundaries
        2. Compress each chunk independently
        3. Rejoin the results
        """
        # Simple sentence splitting
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = []
        current_len = 0
        
        for sent in sentences:
            sent_len = len(sent.split())
            if current_len + sent_len > self.config.chunk_size * 0.8:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                current_chunk = [sent]
                current_len = sent_len
            else:
                current_chunk.append(sent)
                current_len += sent_len
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        # Compress each chunk
        compressed_chunks = []
        total_orig = 0
        total_comp = 0
        
        for chunk in chunks:
            result = self.compress(chunk, query, target_ratio)
            compressed_chunks.append(result.compressed_text)
            total_orig += result.original_tokens
            total_comp += result.compressed_tokens
        
        # Combine
        final_text = " ".join(compressed_chunks)
        
        return CompressionResult(
            original_text=text,
            compressed_text=final_text,
            original_tokens=total_orig,
            compressed_tokens=total_comp,
            token_scores=np.array([]),  # Not meaningful for multi-chunk
            kept_indices=[],
            compression_ratio=total_comp / total_orig if total_orig > 0 else 1.0
        )


# =============================================================================
# Convenience Functions
# =============================================================================

# Global instance for quick use
_default_compressor = None

def get_compressor(config: Optional[CompressorConfig] = None) -> ScratchCompressor:
    """Get or create the default compressor instance."""
    global _default_compressor
    if _default_compressor is None or config is not None:
        _default_compressor = ScratchCompressor(config)
    return _default_compressor


def compress(
    text: str, 
    query: Optional[str] = None, 
    target_ratio: float = 0.34
) -> str:
    """
    Quick compression function. Automatically uses chunking for long texts.
    
    Args:
        text: Text to compress
        query: Optional query for query-aware compression
        target_ratio: Fraction of tokens to keep (0.34 = 66% reduction)
    
    Returns:
        Compressed text string
    """
    compressor = get_compressor()
    
    # Use chunking for long texts (> 400 words)
    word_count = len(text.split())
    if word_count > 400:
        result = compressor.compress_chunks(text, query, target_ratio)
    else:
        result = compressor.compress(text, query, target_ratio)
    
    return result.compressed_text


def compress_with_metrics(
    text: str,
    query: Optional[str] = None,
    target_ratio: float = 0.34
) -> CompressionResult:
    """
    Compress with full metrics returned. Automatically uses chunking for long texts.
    """
    compressor = get_compressor()
    
    # Use chunking for long texts
    word_count = len(text.split())
    if word_count > 400:
        return compressor.compress_chunks(text, query, target_ratio)
    else:
        return compressor.compress(text, query, target_ratio)


# =============================================================================
# Demo / Test
# =============================================================================

if __name__ == "__main__":
    print("="*60)
    print("FROM-SCRATCH COMPRESSOR TEST")
    print("="*60)
    
    # Test text
    test_text = """
    The company reported strong quarterly earnings for Q3 2025. Revenue increased 
    by approximately 25 percent year-over-year. Due to the fact that the firm 
    showed robust financial results for the quarter, investor confidence grew 
    significantly. In the event that market conditions remain favorable, profits 
    could exceed expectations by a large margin. It is important to note that 
    North America saw domestic sales increase substantially. At this point in time, 
    the outlook remains positive for continued growth. The board approved expansion 
    plans for the purpose of entering new markets in Asia and Europe.
    """
    
    test_query = "How did the company perform financially?"
    
    # Initialize compressor
    config = CompressorConfig(target_ratio=0.34)
    compressor = ScratchCompressor(config)
    
    # Test without query
    print("\n--- Without Query ---")
    result = compressor.compress(test_text)
    print(f"Original: {result.original_tokens} tokens")
    print(f"Compressed: {result.compressed_tokens} tokens")
    print(f"Reduction: {result.reduction_pct:.1f}%")
    print(f"Output: {result.compressed_text[:200]}...")
    
    # Test with query
    print("\n--- With Query ---")
    result_qa = compressor.compress(test_text, query=test_query)
    print(f"Original: {result_qa.original_tokens} tokens")
    print(f"Compressed: {result_qa.compressed_tokens} tokens")
    print(f"Reduction: {result_qa.reduction_pct:.1f}%")
    print(f"Output: {result_qa.compressed_text[:200]}...")
    
    print("\n" + "="*60)
    print("COMPARISON WITH BEAR-1 TARGET")
    print("="*60)
    print(f"Bear-1 target: 66% reduction")
    print(f"Our reduction (no query): {result.reduction_pct:.1f}%")
    print(f"Our reduction (with query): {result_qa.reduction_pct:.1f}%")
