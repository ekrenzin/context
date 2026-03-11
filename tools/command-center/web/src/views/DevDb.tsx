import { Box, Typography, Paper, Grid, Button, Card, CardContent, CardActions } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { useVscodeCommand } from "../hooks/useMqtt";

export function DevDb() {
  const send = useVscodeCommand();

  const handleLaunchTerminal = () => {
    send({
      type: "vscode:openTerminal",
      name: "SOS: Dev DB",
      cwd: "repos/app-platform",
      command: "echo 'To connect to DB, use the direct-db-cli skill guidelines.'",
    });
  };

  const handleSeed = () => {
    send({
      type: "vscode:openTerminal",
      name: "SOS: DB Seed",
      cwd: "repos/app-platform",
      command: "npm run db:seed", // customizable
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2 }}>
        <StorageIcon fontSize="large" color="primary" />
        <Typography variant="h4" component="h1">
          Dev Database
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <TerminalIcon color="action" />
                <Typography variant="h6">Direct Access</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Open a terminal in <code>repos/app-platform</code> to interact with the database using Node.js + pg, following the <code>direct-db-cli</code> skill safety rules.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" variant="contained" onClick={handleLaunchTerminal}>
                Open Terminal
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <AddCircleIcon color="action" />
                <Typography variant="h6">Seed Data</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Run standard Sequelize seeders to populate the database with test data.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" variant="outlined" onClick={handleSeed}>
                Run Seeds
              </Button>
            </CardActions>
          </Card>
        </Grid>

         <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <CleaningServicesIcon color="action" />
                <Typography variant="h6">Cleanup</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Clean up test artifacts. (Requires <code>direct-db-cli</code> logic).
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" variant="outlined" disabled>
                Cleanup (Coming Soon)
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
