import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  TextField,
  Typography,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import { useAuth } from "../../hooks/useAuth";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();

  if (!configured) return <>{children}</>;
  if (loading) return null;
  if (user) return <>{children}</>;

  return <LoginForm />;
}

export function LoginForm() {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleMagicLink() {
    if (!email) return;
    setSubmitting(true);
    setError(null);
    const result = await signInWithMagicLink(email);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
      }}
    >
      <Card sx={{ maxWidth: 400, width: "100%" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Sign in to access settings and sync.
          </Typography>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<GoogleIcon />}
            onClick={signInWithGoogle}
            sx={{ mb: 2 }}
          >
            Continue with Google
          </Button>

          <Divider sx={{ my: 2 }}>or</Divider>

          {sent ? (
            <Alert severity="success">
              Check your email for a sign-in link.
            </Alert>
          ) : (
            <>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                sx={{ mb: 2 }}
              />
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <Button
                variant="contained"
                fullWidth
                startIcon={<EmailIcon />}
                onClick={handleMagicLink}
                disabled={!email || submitting}
                disableElevation
              >
                {submitting ? "Sending..." : "Send magic link"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
