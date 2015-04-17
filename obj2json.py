#!/usr/bin/python3

"""Converts obj file into json"""

import argparse
import re
import json

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("obj_file", metavar="OBJFILE")
    parser.add_argument("json_file", metavar="JSONFILE")
    parser.add_argument("--js", dest="js_expr", action="store_true",
            default=False, help="write output as js expression")
    args = parser.parse_args()

    numbers_re = re.compile("\s+")
    vertexes = []
    faces = []
    with open(args.obj_file, "r") as fin:
        for line in fin:
            if line[0] == "v":
                a, b, c = numbers_re.split(line)[1:4]
                vertexes.append((float(a), float(b), float(c)))
            elif line[0] == "f":
                a, b, c = numbers_re.split(line)[1:4]
                faces.append((int(a)-1, int(b)-1, int(c)-1))

    print("Converted {} vertexes and {} faces".format(len(vertexes), len(faces)))
    with open(args.json_file, "w") as fout:
        if args.js_expr:
            fout.write("vertexes=[\n")
            fout.write(",\n".join(json.dumps(v) for v in vertexes))
            fout.write("];")

            fout.write("\nfaces=[\n")
            fout.write(",\n".join(json.dumps(f) for f in faces))
            fout.write("];")
        else:
            obj = {
                "vertexes": vertexes,
                "faces": faces,
            }
            json.dump(obj, fout)

main()
