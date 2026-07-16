import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const scanRoots = ["app", "components"];
const files = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) {
    const absolute = path.join(directory, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) walk(absolute);
    else if (/\.(tsx|jsx)$/.test(name)) files.push(absolute);
  }
}

for (const directory of scanRoots) walk(path.join(root, directory));

const issues = [];

function getAttributes(opening) {
  const attributes = new Map();
  for (const property of opening.attributes.properties) {
    if (ts.isJsxAttribute(property)) attributes.set(property.name.text, property.initializer);
  }
  return attributes;
}

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = opening.tagName.getText(source);
      const attributes = getAttributes(opening);
      const location = source.getLineAndCharacterOfPosition(opening.getStart(source));
      const record = (kind, detail) => issues.push({
        file: path.relative(root, file),
        line: location.line + 1,
        kind,
        detail,
      });

      if (tagName === "button") {
        const typeAttribute = attributes.get("type");
        const submitButton = typeAttribute && ts.isStringLiteral(typeAttribute) && typeAttribute.text === "submit";
        const hasAction = attributes.has("onClick") || attributes.has("formAction");
        if (!submitButton && !hasAction) record("button-without-action", "按钮没有 onClick、formAction 或 submit 行为");
      }

      if (tagName === "Link") {
        const href = attributes.get("href");
        if (href && ts.isStringLiteral(href) && (href.text === "" || href.text === "#")) {
          record("empty-link", "Link 使用空地址或 # 占位地址");
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

if (issues.length) {
  console.error("\nUI 交互审计失败：\n");
  for (const issue of issues) {
    console.error(`- ${issue.file}:${issue.line} [${issue.kind}] ${issue.detail}`);
  }
  console.error(`\n共发现 ${issues.length} 个问题。\n`);
  process.exit(1);
}

console.log(`UI 交互审计通过：扫描 ${files.length} 个 TSX/JSX 文件，未发现无行为按钮或空链接。`);
