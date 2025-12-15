import torch

print(f"PyTorch version: {torch.__version__}")
print(f"CUDA version no PyTorch: {torch.version.cuda}")
print(f"GPU Disponível? {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"Nome da GPU: {torch.cuda.get_device_name(0)}")
    # Teste crítico: Tentar criar um tensor na VRAM para ver se não dá erro de kernel
    try:
        x = torch.rand(5, 3).cuda()
        print("Sucesso! Tensor criado na memória da RTX 5070.")
    except Exception as e:
        print(f"Erro ao usar a GPU: {e}")