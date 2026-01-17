from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Solace AI backend is live!"}
