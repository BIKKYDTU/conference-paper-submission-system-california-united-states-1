#!/bin/bash
### COMMON SETUP; DO NOT MODIFY ###
set -e

# --- CONFIGURE THIS SECTION ---
run_all_tests() {
    echo "Running all tests..."

    if [ -d "/eval_assets/tests" ]; then
        mkdir -p /app/tests
        tar -C /eval_assets/tests -cf - . 2>/dev/null | tar -C /app/tests -xf - 2>/dev/null || true
    fi

    cd /app
    mkdir -p uploads
    DB_PATH=:memory: npx jest --forceExit --detectOpenHandles --verbose 2>&1 || true
}
# --- END CONFIGURATION SECTION ---

### COMMON EXECUTION; DO NOT MODIFY ###
run_all_tests
