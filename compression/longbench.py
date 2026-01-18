import os
import re
import time
import torch
import numpy as np
import pandas as pd
import tiktoken
import requests
import dotenv
from datasets import load_dataset
from tqdm import tqdm
from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from huggingface_hub import login
from llmlingua import PromptCompressor
import tokenc

# ---------------------------------------------------------
# 1. Setup & Config
# ---------------------------------------------------------
dotenv.load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
HF_TOKEN = os.getenv("HF")
if HF_TOKEN:
    login(token=HF_TOKEN)
device = "mps" if torch.backends.mps.is_available() else "cuda"

# Token Counter Fix: pass disallowed_special=() to ignore errors
token_encoder = tiktoken.encoding_for_model("gpt-4o-mini")

def count_tokens(text: str) -> int:
    """Returns token count, allowing special tokens like <|endoftext|>."""
    return len(token_encoder.encode(text, disallowed_special=()))

# ---------------------------------------------------------
# 2. Model Loading
# ---------------------------------------------------------

ttc_client = tokenc.TokenClient(api_key=os.getenv("TOKEN_API_KEY"))

# From-scratch compressor
from scratch import ScratchCompressor, CompressorConfig
scratch_config = CompressorConfig(target_ratio=0.34)
scratch_compressor = ScratchCompressor(scratch_config)

# MiniLM-based compressor (Optimization: smaller, faster model)
# MiniLM-L6-H384: 22M params vs DistilBERT's 66M = 3x smaller
scratch_minilm_config = CompressorConfig(
    target_ratio=0.34,
    encoder_model="nreimers/MiniLM-L6-H384-uncased"
)
scratch_minilm_compressor = ScratchCompressor(scratch_minilm_config)

# ---------------------------------------------------------
# 3. OpenRouter API for LLM calls
# ---------------------------------------------------------
def call_openrouter(prompt: str, model: str = "google/gemini-3-flash-preview") -> str:
    """Call OpenRouter API with given prompt."""
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 20,
            "temperature": 0,
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"OpenRouter API error: {response.status_code} - {response.text}")
    
    return response.json()["choices"][0]["message"]["content"].strip()

# ---------------------------------------------------------
# 3. Compression Functions
# ---------------------------------------------------------


def ttc_compress(context: str):
    settings = tokenc.CompressionSettings(aggressiveness=0.9)
    try:
        res = ttc_client.compress_input(input=context, compression_settings=settings)
        return res.output
    except Exception as e:
        print(f"TTC API error: {e}, returning original")
        return context

def scratch_compress(context: str, query: str = None) -> str:
    """Use our from-scratch compressor with chunking for long texts."""
    # Use compress_chunks for long contexts (> 500 words)
    word_count = len(context.split())
    if word_count > 500:
        result = scratch_compressor.compress_chunks(context, query=query)
    else:
        result = scratch_compressor.compress(context, query=query)
    return result.compressed_text

def scratch_compress_qa(context: str, question: str) -> str:
    """Query-aware scratch compression with chunking for long texts."""
    # Use compress_chunks for long contexts (> 500 words)
    word_count = len(context.split())
    if word_count > 500:
        result = scratch_compressor.compress_chunks(context, query=question)
    else:
        result = scratch_compressor.compress(context, query=question)
    return result.compressed_text

def scratch_compress_minilm(context: str, query: str = None) -> str:
    """MiniLM-based scratch compression (3x smaller model, faster inference)."""
    word_count = len(context.split())
    if word_count > 500:
        result = scratch_minilm_compressor.compress_chunks(context, query=query)
    else:
        result = scratch_minilm_compressor.compress(context, query=query)
    return result.compressed_text

# ---------------------------------------------------------
# 5. Evaluation Pipeline
# ---------------------------------------------------------
def verify_answer(predicted: str, gold: str) -> bool:
    print(predicted)
    """
    Check if the predicted answer matches the gold answer.
    Extracts single letter A-D from the response.
    """
    # Remove markdown formatting
    predicted_clean = re.sub(r'\*+', '', predicted)  # Remove * and **
    predicted_upper = predicted_clean.upper().strip()
    gold_upper = gold.upper().strip()
    print(f"Predicted: {predicted_upper}, Answer: {gold_upper}")
    
    # Try direct single letter match first
    if predicted_upper in ['A', 'B', 'C', 'D']:
        return predicted_upper == gold_upper
    
    # Try to find letter in various patterns
    patterns = [
        r'\(([A-D])\)',           # (A), (B), etc.
        r'\b([A-D])\.',           # A., B., etc.
        r'OPTION[:\s]*\(?([A-D])\)?',   # "option: A" or "option (A)"
        r'ANSWER[:\s]*\(?([A-D])\)?',   # "answer: A" or "answer (A)"
        r'CORRECT[^A-D]*([A-D])',        # "correct option is A"
        r'^\s*([A-D])\b',               # starts with letter
        r'\b([A-D])\b',                 # standalone A, B, etc. (last resort)
    ]
    
    for pattern in patterns:
        match = re.search(pattern, predicted_upper)
        if match:
            return match.group(1) == gold_upper
    
    return False

def run_longbench_eval(sample_first_x=None, max_token_limit=100000):
    print("Loading LongBench-v2...")
    ds = load_dataset("THUDM/LongBench-v2", split='train')
    
    print(f"Filtering contexts > {max_token_limit} tokens...")
    valid_data = [item for item in tqdm(ds) if count_tokens(item['context']) <= max_token_limit]
    
    print(f'{len(valid_data)} remaining longbench items after filtering')

    if sample_first_x:
        valid_data = valid_data[:sample_first_x]
    
    print(f"Evaluating {len(valid_data)} samples.")
    
    # Compare: Baseline, Bear-1, scratch, scratch-MiniLM
    configs = {
        "Baseline": lambda ctx, q: ctx,
        "ttc (Bear-1)": lambda ctx, q: ttc_compress(ctx),
        "scratch qa": lambda ctx, q: scratch_compress_qa(ctx, q),
        #"scratch": lambda ctx, q: scratch_compress(ctx),
        #"scratch-MiniLM": lambda ctx, q: scratch_compress_minilm(ctx, query=q),  # Query-aware compression
    }

    summary_results = []

    for name, func in configs.items():
        print(f"\n[Config: {name}]")
        correct, total_saved_pct = 0, []
        total_compression_time = 0.0
        n_samples = len(valid_data)
        
        for i, item in enumerate(valid_data):
            # Time the compression
            compress_start = time.time()
            compressed_context = func(item['context'], item['question'])
            compress_end = time.time()
            total_compression_time += (compress_end - compress_start)
            
            orig_len = count_tokens(item['context'])
            comp_len = count_tokens(compressed_context)
            total_saved_pct.append(1 - (comp_len / orig_len) if orig_len > 0 else 0)
            
            prompt = (
                f"Context:\n{compressed_context}\n\nQuestion: {item['question']}\n"
                f"Options:\n(A) {item['choice_A']}\n(B) {item['choice_B']}\n(C) {item['choice_C']}\n(D) {item['choice_D']}\n\n"
                f"Answer with ONLY the letter (A), (B), (C), or (D). Do NOT reply with anything other than the answer choice."
            )
            
            try:
                response = call_openrouter(prompt)
                if verify_answer(response, item['answer']):
                    correct += 1
            except Exception as e:
                print(f"API Error: {e}")
            
            # Print running results after each question
            running_accuracy = (correct / (i + 1)) * 100
            running_reduction = np.mean(total_saved_pct) * 100
            running_latency = total_compression_time / (i + 1)
            print(f"  [{i+1}/{n_samples}] Acc: {running_accuracy:.1f}% | Reduction: {running_reduction:.1f}% | Avg Latency: {running_latency:.2f}s | Total Time: {total_compression_time:.1f}s")

        accuracy = (correct / len(valid_data)) * 100
        avg_reduction = np.mean(total_saved_pct) * 100
        avg_latency = total_compression_time / len(valid_data)
        
        summary_results.append({
            "Config": name,
            "Accuracy": f"{accuracy:.1f}%",
            "Token Reduction": f"{avg_reduction:.1f}%",
            "Avg Latency (s)": f"{avg_latency:.2f}",
            "Total Time (s)": f"{total_compression_time:.1f}",
            #"Delta vs Baseline": "—" if name == "Baseline" else f"{accuracy - summary_results[0]['raw_acc']:+.1f}%",
            "raw_acc": accuracy
        })

    df = pd.DataFrame(summary_results).drop(columns=['raw_acc'])
    print("\n" + "="*60 + "\nLONGBENCH-V2 COMPRESSION BENCHMARK\n" + "="*60)
    print(df.to_string(index=False))

if __name__ == "__main__":
    import sys
    sample_count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    run_longbench_eval(sample_first_x=sample_count)