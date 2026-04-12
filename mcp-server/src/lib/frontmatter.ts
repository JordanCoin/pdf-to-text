export interface SkillMetadata {
  name: string;
  description: string;
  content: string;
  frontmatter: Record<string, string>;
  sections: string[];
}

export function parseSkillMd(raw: string): SkillMetadata {
  let frontmatter: Record<string, string> = {};
  let body = raw;

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fmMatch) {
    frontmatter = parseFlatYaml(fmMatch[1]);
    body = fmMatch[2];
  }

  const sections = [...body.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => m[1]);

  return {
    name: frontmatter["name"] ?? sections[0] ?? "Untitled",
    description: frontmatter["description"] ?? "",
    content: body.trim(),
    frontmatter,
    sections,
  };
}

function parseFlatYaml(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[match[1]] = val;
    }
  }
  return result;
}
