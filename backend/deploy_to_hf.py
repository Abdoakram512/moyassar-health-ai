"""
Moyassar Health AI - Automated Hugging Face Spaces Deployment Script
Uploads the FastAPI microservice and real YOLOv8 models to a free, cloud-hosted HF Space.
"""

import os
import sys
from huggingface_hub import HfApi, login

def deploy(token: str = None):
    token = token or os.environ.get("HF_TOKEN")
    if not token:
        token = input("Enter your Hugging Face Access Token (with WRITE role): ").strip()

    if not token:
        print("[!] Error: No token provided.")
        sys.exit(1)

    print("[*] Authenticating with Hugging Face...")
    try:
        login(token=token, add_to_git_credential=False)
        api = HfApi(token=token)
        user_info = api.whoami()
        username = user_info["name"]
        print(f"[+] Authenticated successfully as user: {username}")
    except Exception as e:
        print(f"[!] Authentication failed: {e}")
        sys.exit(1)

    repo_name = "moyassar-health-ai-api"
    repo_id = f"{username}/{repo_name}"

    print(f"[*] Creating / verifying Hugging Face Docker Space: {repo_id}...")
    try:
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="docker",
            exist_ok=True,
            private=False
        )
        print(f"[+] Space repository verified: https://huggingface.co/spaces/{repo_id}")
    except Exception as e:
        print(f"[!] Error creating repo: {e}")
        sys.exit(1)

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"[*] Uploading backend files and trained YOLO models from {backend_dir}...")
    try:
        api.upload_folder(
            folder_path=backend_dir,
            repo_id=repo_id,
            repo_type="space",
            ignore_patterns=["__pycache__/*", "*.pyc", "deploy_to_hf.py", ".git/*"]
        )
        print("[+] All files and models uploaded successfully!")
    except Exception as e:
        print(f"[!] Upload failed: {e}")
        sys.exit(1)

    public_api_url = f"https://{username.lower()}-{repo_name}.hf.space"
    print("\n" + "="*70)
    print("🚀 DEPLOYMENT COMPLETED SUCCESSFULLY!")
    print(f"Space URL:       https://huggingface.co/spaces/{repo_id}")
    print(f"Public API URL:  {public_api_url}")
    print(f"Interactive Docs: {public_api_url}/docs")
    print(f"Health Endpoint: {public_api_url}/api/v1/health")
    print("="*70 + "\n")
    return public_api_url

if __name__ == "__main__":
    cli_token = sys.argv[1] if len(sys.argv) > 1 else None
    deploy(cli_token)
