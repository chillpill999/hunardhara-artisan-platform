# -*- coding: utf-8 -*-
"""
Hunar Saathi - Free Google Colab Fine-Tuning Pipeline (Unsloth + QLoRA)
SIH 2026 Problem Statement: SIH26090 (Ministry of Social Justice and Empowerment)

Run this script on a FREE Google Colab T4 GPU (Runtime -> Change runtime type -> T4 GPU).
Training time: ~15-20 minutes
Zero API cost, fully sovereign open-source model.
"""

# 1. Install Unsloth & dependencies
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes

from unsloth import FastLanguageModel
import torch
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# Configuration
MAX_SEQ_LENGTH = 2048
DTYPE = None # Auto detection (Float16 for T4)
LOAD_IN_4BIT = True # 4-bit quantization fits comfortably in Colab's 15GB VRAM

# 2. Load Base Model (Qwen-2.5-7B or Llama-3.1-8B)
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Qwen2.5-7B-Instruct-bnb-4bit", # Or "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit"
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=DTYPE,
    load_in_4bit=LOAD_IN_4BIT,
)

# 3. Add LoRA Adapters (1-2% of model parameters trained)
model = FastLanguageModel.get_peft_model(
    model,
    r=16, # Rank
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0, # Optimized 0 for Unsloth
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)

# 4. Load Artisan Dataset
# Upload artisan_training_dataset.jsonl to Colab
dataset = load_dataset("json", data_files="artisan_training_dataset.jsonl", split="train")

def format_prompts(examples):
    conversations = examples["messages"]
    texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in conversations]
    return {"text": texts}

formatted_dataset = dataset.map(format_prompts, batched=True)

# 5. Fine-Tune with SFTTrainer
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=formatted_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=60, # ~3 epochs over sample dataset
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=3407,
        output_dir="outputs",
    ),
)

trainer_stats = trainer.train()

# 6. Save LoRA Adapter & Push to Hugging Face (Free)
model.save_pretrained("hunar_saathi_lora")
tokenizer.save_pretrained("hunar_saathi_lora")
print("LoRA fine-tuning complete! Saved to ./hunar_saathi_lora")

# To export GGUF for local Ollama:
# model.save_pretrained_gguf("hunar_saathi_gguf", tokenizer, quantization_method="q4_k_m")
