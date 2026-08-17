import os
import json
import traceback

backup_dir = r"C:\Users\ccarvajalino\OneDrive\H Plus\Contabilidad\Backup"
output_file = r"C:\Users\ccarvajalino\OneDrive\Proyectos\Contable\.agents\explorer_survey_2\backup_structure.json"

result = {
    "exists": False,
    "dir_path": backup_dir,
    "tree": [],
    "error": None
}

try:
    if os.path.exists(backup_dir):
        result["exists"] = True
        tree_data = []
        for root, dirs, files in os.walk(backup_dir):
            rel_root = os.path.relpath(root, backup_dir)
            tree_data.append({
                "path": rel_root,
                "dirs": dirs,
                "files": files
            })
        result["tree"] = tree_data
    else:
        result["error"] = "Directory does not exist"
except Exception as e:
    result["error"] = str(e)
    result["traceback"] = traceback.format_exc()

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"Inspection complete. Exists: {result['exists']}. Saved to {output_file}")
