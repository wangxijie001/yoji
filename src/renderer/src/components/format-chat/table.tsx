import type { ReactNode, CSSProperties, ReactElement } from "react";

interface TableProps {
    children: ReactNode;
}

interface TdProps {
    children: ReactNode;
}

const styles: Record<string, CSSProperties> = {
    paragraph: { margin: "6px 0", fontSize: "14px", lineHeight: "26px" },
    list: { margin: "6px 0" },
    table: { borderCollapse: "collapse", width: "100%", margin: "10px 0"},
    th: { border: "1px solid #ddd", padding: "8px", textAlign: "left", background: "#f9f9f9" },
    td: { border: "1px solid #ddd", padding: "8px" },
};

export const tableBlock: Record<string, (props: TableProps) => ReactElement> = {
    table: ({ children }: TableProps) => <table style={styles.table}>{children}</table>,
    th: ({ children }: TableProps) => <th style={styles.th}>{children}</th>,
    td: ({ children }: TdProps) => <td style={styles.td}>{children}</td>,
};
