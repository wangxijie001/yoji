import type { ThemeConfig } from "antd";

export const customAntdVar: ThemeConfig | undefined = {
  token: {
    colorPrimary: '#5cdbd3',
    borderRadius: 8
  },
  components: {
    Table: {
      cellPaddingBlock: 12,
    },
    Input: {
      hoverBorderColor:"transparent",
      activeBorderColor:"transparent",
      activeShadow:"none",
    }
  }
}