#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"
IMAGE_NAME="real-coder-task"
CONTAINER_NAME="real-coder-verify-$$"

cleanup() {
    echo ""
    echo "Cleaning up container..."
    docker stop ${CONTAINER_NAME} > /dev/null 2>&1 || true
    docker rm ${CONTAINER_NAME} > /dev/null 2>&1 || true
}
trap cleanup EXIT

echo "============================================="
echo "  VERIFICATION SCRIPT"
echo "============================================="

echo ""
echo "[1/8] Verifying app/ folder structure..."
for f in Dockerfile run.sh parsing.py codebase.zip tests.zip; do
    if [ ! -f "${APP_DIR}/${f}" ]; then
        echo "ERROR: Missing ${APP_DIR}/${f}"
        exit 1
    fi
done
echo "  All required files present in app/"

echo ""
echo "[2/8] Building Docker image from app/Dockerfile..."
docker build -t ${IMAGE_NAME} "${APP_DIR}" 2>&1 | tail -5
echo "  Docker image built successfully"

echo ""
echo "[3/8] Starting container..."
docker create --name ${CONTAINER_NAME} ${IMAGE_NAME} sleep 3600 > /dev/null
docker start ${CONTAINER_NAME} > /dev/null
echo "  Container started: ${CONTAINER_NAME}"

echo ""
echo "[4/8] Injecting tests.zip and setting up BEFORE environment..."
docker cp "${APP_DIR}/tests.zip" ${CONTAINER_NAME}:/eval_assets/tests.zip
docker cp "${APP_DIR}/run.sh" ${CONTAINER_NAME}:/app/run.sh
docker cp "${APP_DIR}/parsing.py" ${CONTAINER_NAME}:/app/parsing.py

docker exec ${CONTAINER_NAME} bash -c '
cd /eval_assets
python3 << EXTRACTPY
import zipfile
with zipfile.ZipFile("tests.zip", "r") as zf:
    zf.extractall(".")
EXTRACTPY
echo "Tests extracted:"
ls /eval_assets/tests/
'

docker exec ${CONTAINER_NAME} bash -c '
cd /app
mkdir -p tests uploads

cat > package.json << PKGJSON
{
  "name": "conference-paper-submission-system",
  "version": "1.0.0",
  "scripts": { "test": "jest --forceExit --detectOpenHandles" },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^11.7.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "jest": "^29.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.0"
  }
}
PKGJSON

cat > tsconfig.json << TSCJSON
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "jsx": "react"
  },
  "include": ["server/**/*", "client/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
TSCJSON

cat > jest.config.js << JESTCFG
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};
JESTCFG

npm install 2>&1 | tail -5
'
echo "  BEFORE environment ready"

echo ""
echo "[5/8] BEFORE: Running tests without codebase..."
docker exec ${CONTAINER_NAME} bash -c "cd /app && bash run.sh" > "${APP_DIR}/before_stdout.txt" 2> "${APP_DIR}/before_stderr.txt" || true

echo "  Parsing BEFORE results..."
python3 "${APP_DIR}/parsing.py" "${APP_DIR}/before_stdout.txt" "${APP_DIR}/before_stderr.txt" "${APP_DIR}/before.json"

echo "  BEFORE results:"
python3 - "${APP_DIR}/before.json" << 'PYCHECK'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
tests = data.get("tests", [])
statuses = {}
for t in tests:
    s = t["status"]
    statuses[s] = statuses.get(s, 0) + 1
print(f"  Total tests: {len(tests)}")
for s, c in sorted(statuses.items()):
    print(f"    {s}: {c}")
PYCHECK

echo ""
echo "[6/8] Injecting codebase.zip into container..."
docker cp "${APP_DIR}/codebase.zip" ${CONTAINER_NAME}:/app/codebase.zip
docker exec ${CONTAINER_NAME} bash -c '
cd /app
python3 << EXTRACTPY2
import zipfile
with zipfile.ZipFile("codebase.zip", "r") as zf:
    zf.extractall(".")
EXTRACTPY2
npm install 2>&1 | tail -5
'
echo "  Codebase injected"

echo ""
echo "[7/8] AFTER: Running tests with codebase..."
docker exec ${CONTAINER_NAME} bash -c "cd /app && bash run.sh" > "${APP_DIR}/after_stdout.txt" 2> "${APP_DIR}/after_stderr.txt" || true

echo "  Parsing AFTER results..."
python3 "${APP_DIR}/parsing.py" "${APP_DIR}/after_stdout.txt" "${APP_DIR}/after_stderr.txt" "${APP_DIR}/after.json"

echo "  AFTER results:"
python3 - "${APP_DIR}/after.json" << 'PYCHECK2'
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
tests = data.get("tests", [])
statuses = {}
for t in tests:
    s = t["status"]
    statuses[s] = statuses.get(s, 0) + 1
print(f"  Total tests: {len(tests)}")
for s, c in sorted(statuses.items()):
    print(f"    {s}: {c}")
PYCHECK2

echo ""
echo "[8/8] Computing fail_to_pass.json and pass_to_pass.json..."
python3 - "${APP_DIR}/before.json" "${APP_DIR}/after.json" "${APP_DIR}/fail_to_pass.json" "${APP_DIR}/pass_to_pass.json" << 'PYCOMPUTE'
import json, sys

with open(sys.argv[1]) as f:
    before = json.load(f)
with open(sys.argv[2]) as f:
    after = json.load(f)

before_map = {t["name"]: t["status"] for t in before.get("tests", [])}
after_map = {t["name"]: t["status"] for t in after.get("tests", [])}

fail_to_pass = []
pass_to_pass = []

for name, after_status in after_map.items():
    before_status = before_map.get(name, "UNKNOWN")
    if before_status == "FAILED" and after_status == "PASSED":
        fail_to_pass.append(name)
    elif before_status == "PASSED" and after_status == "PASSED":
        pass_to_pass.append(name)

with open(sys.argv[3], "w") as f:
    json.dump({"tests": fail_to_pass}, f, indent=2)

with open(sys.argv[4], "w") as f:
    json.dump({"tests": pass_to_pass}, f, indent=2)

print(f"  fail_to_pass: {len(fail_to_pass)} tests")
print(f"  pass_to_pass: {len(pass_to_pass)} tests")
PYCOMPUTE

echo ""
echo "============================================="
echo "  VERIFICATION COMPLETE"
echo "============================================="
echo ""
echo "Output files in app/:"
ls -la "${APP_DIR}"/*.json "${APP_DIR}"/*_stdout.txt "${APP_DIR}"/*_stderr.txt 2>/dev/null || true
echo ""

python3 - "${APP_DIR}" << 'PYSUMMARY'
import json, sys

app_dir = sys.argv[1]

with open(f"{app_dir}/before.json") as f:
    before = json.load(f)
with open(f"{app_dir}/after.json") as f:
    after = json.load(f)

before_tests = before.get("tests", [])
after_tests = after.get("tests", [])

before_all_failed = all(t["status"] == "FAILED" for t in before_tests) if before_tests else False
after_all_passed = all(t["status"] == "PASSED" for t in after_tests) if after_tests else False

print("SUMMARY:")
print(f"  Before: {len(before_tests)} tests, all FAILED = {before_all_failed}")
print(f"  After:  {len(after_tests)} tests, all PASSED = {after_all_passed}")

if before_all_failed and after_all_passed and len(before_tests) > 0 and len(after_tests) > 0:
    print()
    print("  *** VERIFICATION PASSED ***")
else:
    print()
    print("  *** VERIFICATION FAILED ***")
    if not before_all_failed:
        for t in before_tests:
            if t["status"] != "FAILED":
                print(f"    BEFORE issue: {t['name']} = {t['status']}")
    if not after_all_passed:
        for t in after_tests:
            if t["status"] != "PASSED":
                print(f"    AFTER issue: {t['name']} = {t['status']}")
PYSUMMARY
