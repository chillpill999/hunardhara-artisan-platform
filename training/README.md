# हुनर साथी (Hunar Saathi) - Free Model Training & Inference

This directory contains the pipeline to **use and train 100% free AI models** for Hunardhara without commercial API charges.

---

## 1. Live Free Inference via Cloudflare Workers AI

Your frontend Cloudflare Worker is already configured and deployed with **Cloudflare Workers AI**:
- **Endpoint**: `POST https://hunardhara.technogamerzthenextlevel.workers.dev/api/edge/chat`
- **Active Model**: `@cf/meta/llama-3.2-3b-instruct` / `@cf/meta/llama-3.1-8b-instruct`
- **Cost**: **Free** (Cloudflare provides 10,000 free neurons every single day)
- **Features**:
  - Edge-accelerated response (under 400ms)
  - Pre-prompted with Indian craft statutory wage formulas (₹650/day)
  - MoSJE scheme guidance (PM-Vishwakarma, PM-DAKSH)

---

## 2. Training Your Own Custom Model (Free on Google Colab)

To fine-tune open-source models (like `Llama-3.1-8B` or `Qwen-2.5-7B`) on your custom craft dataset for free:

### Step 1: Open Google Colab
1. Go to [Google Colab](https://colab.research.google.com/).
2. Select **Runtime** -> **Change runtime type** -> **T4 GPU** (Free tier).

### Step 2: Upload Files
Upload `train_colab.py` and `artisan_training_dataset.jsonl` from this folder.

### Step 3: Run Training
Execute `train_colab.py`. Unsloth QLoRA will fine-tune the model in **~15 minutes** using less than 7GB of GPU RAM.

### Step 4: Export & Host for Free
- **Option A (Hugging Face Hub)**: Push the lightweight LoRA adapter (~50MB) to your free Hugging Face account and query it via the free Hugging Face Inference API.
- **Option B (Cloudflare Workers AI LoRA)**: Upload the LoRA adapter directly to Cloudflare Workers AI using `wrangler ai lora upload`.
- **Option C (Ollama / Local)**: Export as a `.gguf` file to run completely offline on any laptop or local server.
