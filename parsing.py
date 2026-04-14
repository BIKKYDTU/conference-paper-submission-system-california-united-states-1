import dataclasses
import json
import sys
import re
from enum import Enum
from pathlib import Path
from typing import List

class TestStatus(Enum):
    """The test status enum."""
    PASSED = 1
    FAILED = 2
    SKIPPED = 3
    ERROR = 4

@dataclasses.dataclass
class TestResult:
    """The test result dataclass."""
    name: str
    status: TestStatus

### DO NOT MODIFY THE CODE ABOVE ###
### Implement the parsing logic below ###

def parse_test_output(stdout_content: str, stderr_content: str) -> List[TestResult]:
    """
    Parse Jest verbose test output and extract individual test results.
    Handles both Unicode checkmark/cross markers and text-based PASS/FAIL markers.
    """
    results = []
    combined = stdout_content + "\n" + stderr_content

    pass_pattern = re.compile(r'^\s*[✓✔√]\s+(.+?)(?:\s+\(\d+\s*m?s\))?\s*$')
    fail_pattern = re.compile(r'^\s*[✕✗×✘]\s+(.+?)(?:\s+\(\d+\s*m?s\))?\s*$')
    skip_pattern = re.compile(r'^\s*[○◌]\s+(?:skipped\s+)?(.+?)(?:\s+\(\d+\s*m?s\))?\s*$')

    current_describe = ""

    for line in combined.split('\n'):
        describe_match = re.match(r'^\s{2,4}(\S.+)$', line)
        if describe_match and not any(p.match(line) for p in [pass_pattern, fail_pattern, skip_pattern]):
            text = describe_match.group(1).strip()
            if not text.startswith(('✓', '✕', '✗', '×', '✘', '○', '◌', '√', '✔', 'PASS', 'FAIL')):
                current_describe = text

        m = pass_pattern.match(line)
        if m:
            test_name = m.group(1).strip()
            if current_describe:
                test_name = f"{current_describe} > {test_name}"
            results.append(TestResult(name=test_name, status=TestStatus.PASSED))
            continue

        m = fail_pattern.match(line)
        if m:
            test_name = m.group(1).strip()
            if current_describe:
                test_name = f"{current_describe} > {test_name}"
            results.append(TestResult(name=test_name, status=TestStatus.FAILED))
            continue

        m = skip_pattern.match(line)
        if m:
            test_name = m.group(1).strip()
            if current_describe:
                test_name = f"{current_describe} > {test_name}"
            results.append(TestResult(name=test_name, status=TestStatus.SKIPPED))
            continue

    if not results:
        for line in combined.split('\n'):
            line = line.strip()
            if line.startswith('Tests:'):
                parts = line.split(',')
                for part in parts:
                    part = part.strip()
                    num_match = re.match(r'(\d+)\s+(passed|failed|skipped)', part)
                    if num_match:
                        count = int(num_match.group(1))
                        status_str = num_match.group(2)
                        status_map = {
                            'passed': TestStatus.PASSED,
                            'failed': TestStatus.FAILED,
                            'skipped': TestStatus.SKIPPED,
                        }
                        status = status_map.get(status_str, TestStatus.ERROR)
                        for i in range(count):
                            results.append(TestResult(
                                name=f"test_{status_str}_{i+1}",
                                status=status
                            ))

    return results

### Implement the parsing logic above ###
### DO NOT MODIFY THE CODE BELOW ###

def export_to_json(results: List[TestResult], output_path: Path) -> None:
    json_results = {
        'tests': [
            {'name': result.name, 'status': result.status.name} for result in results
        ]
    }
    with open(output_path, 'w') as f:
        json.dump(json_results, f, indent=2)

def main(stdout_path: Path, stderr_path: Path, output_path: Path) -> None:
    with open(stdout_path) as f:
        stdout_content = f.read()
    with open(stderr_path) as f:
        stderr_content = f.read()
    results = parse_test_output(stdout_content, stderr_content)
    export_to_json(results, output_path)

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print('Usage: python parsing.py <stdout_file> <stderr_file> <output_json>')
        sys.exit(1)
    main(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
