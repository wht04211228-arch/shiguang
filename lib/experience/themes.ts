export type ThemeKey = "film" | "galaxy" | "cinema";

export type ThemeDefinition = {
  key: ThemeKey;
  letter: "A" | "B" | "C";
  name: string;
  shortName: string;
  promise: string;
  audience: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    accent: string;
    glow: string;
  };
};

export const themeDefinitions: Record<ThemeKey, ThemeDefinition> = {
  film: {
    key: "film",
    letter: "C",
    name: "温暖胶片",
    shortName: "怀旧温暖日记风",
    promise: "把那些普通却珍贵的日子，重新装订成一本只属于我们的相册。",
    audience: "父母、家人、老朋友、毕业与长期关系",
    colors: {
      background: "#F8F1E9",
      surface: "#FFF9F1",
      text: "#5A4636",
      accent: "#D2B48C",
      glow: "#C8A66A",
    },
  },
  galaxy: {
    key: "galaxy",
    letter: "B",
    name: "梦幻星空",
    shortName: "克制高级浪漫风",
    promise: "把我们相隔的距离，连成只属于两个人的秘密星座。",
    audience: "恋人、异地情侣、生日、周年与求婚",
    colors: {
      background: "#1E2A44",
      surface: "#263552",
      text: "#F7F5FF",
      accent: "#E0D4FF",
      glow: "#F5D98B",
    },
  },
  cinema: {
    key: "cinema",
    letter: "A",
    name: "私人电影",
    shortName: "高仪式感电影叙事风",
    promise: "把我们的故事，剪辑成一部只属于彼此、未完待续的电影。",
    audience: "恋爱周年、告白、求婚与重要里程碑",
    colors: {
      background: "#0F172A",
      surface: "#161F34",
      text: "#FFFFFF",
      accent: "#F5C16B",
      glow: "#F5C16B",
    },
  },
};

export const themeOrder: ThemeKey[] = ["galaxy", "cinema", "film"];

export function isThemeKey(value: string): value is ThemeKey {
  return value === "film" || value === "galaxy" || value === "cinema";
}
