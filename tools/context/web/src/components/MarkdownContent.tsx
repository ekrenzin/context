import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Typography,
  Link,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <Typography variant="h5" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="h6" fontWeight={600} sx={{ mt: 2.5, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1.5, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.7 }}>
      {children}
    </Typography>
  ),
  a: ({ href, children }) => (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
    >
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ pl: 2.5, my: 0.5, "& li": { mb: 0.25 } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ pl: 2.5, my: 0.5, "& li": { mb: 0.25 } }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography component="li" variant="body2" sx={{ lineHeight: 1.7 }}>
      {children}
    </Typography>
  ),
  blockquote: ({ children }) => (
    <Box
      sx={{
        pl: 2,
        borderLeft: 3,
        borderColor: "primary.main",
        ml: 1,
        my: 1,
        fontStyle: "italic",
        color: "text.secondary",
      }}
    >
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 2 }} />,
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <Box
          component="pre"
          sx={{
            bgcolor: "action.hover",
            borderRadius: 1,
            p: 1.5,
            my: 1,
            overflow: "auto",
            fontSize: "0.8rem",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code>{children}</code>
        </Box>
      );
    }
    return (
      <Box
        component="code"
        sx={{
          bgcolor: "action.hover",
          borderRadius: 0.5,
          px: 0.6,
          py: 0.15,
          fontSize: "0.8em",
          fontFamily: "monospace",
        }}
      >
        {children}
      </Box>
    );
  },
  table: ({ children }) => (
    <TableContainer sx={{ my: 1.5 }}>
      <Table size="small">{children}</Table>
    </TableContainer>
  ),
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", py: 0.75 }}>
      {children}
    </TableCell>
  ),
  td: ({ children }) => (
    <TableCell sx={{ fontSize: "0.8rem", py: 0.75 }}>{children}</TableCell>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ fontWeight: 600 }}>
      {children}
    </Box>
  ),
  em: ({ children }) => <em>{children}</em>,
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
