import argparse
import json

from pacific_data.pdh_client import search_dataflows


parser = argparse.ArgumentParser(description="Search the live Pacific Data Hub catalogue")
parser.add_argument("query")
parser.add_argument("--limit", type=int, default=20)
args = parser.parse_args()
print(json.dumps(search_dataflows(args.query, args.limit), indent=2))

