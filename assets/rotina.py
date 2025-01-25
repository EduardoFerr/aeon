import os

def rename_files(directory, start_number):
    # Verifica se o diretório existe
    if not os.path.exists(directory):
        print(f"Erro: O diretório '{directory}' não foi encontrado.")
        return

    # Lista todos os arquivos no diretório que começam com "crowley-p"
    files = sorted([f for f in os.listdir(directory) if f.startswith("crowley-o")])
    
    current_number = start_number
    for file in files:
        # Divide o nome e a extensão
        file_name, file_extension = os.path.splitext(file)
        
        # Gera o novo nome
        new_name = f"crowley-{current_number}{file_extension}"
        
        # Renomeia o arquivo
        old_path = os.path.join(directory, file)
        new_path = os.path.join(directory, new_name)
        os.rename(old_path, new_path)
        
        print(f"Renomeado: {file} -> {new_name}")
        current_number += 1

# Substitua pelo caminho correto
rename_files(r"/mnt/c/Users/user/Documents/Workspace2025/thoth/assets/cards/ouros", 64)
