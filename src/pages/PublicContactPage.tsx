import { FormEvent, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import YouTubeIcon from "@mui/icons-material/YouTube";
import PublicSiteShell from "../components/PublicSiteShell";
import { appSwal } from "../utils/swal";

export default function PublicContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await appSwal.fire({
      icon: "success",
      title: "Message received",
      text: "The public relations team will follow up through the contact channel you provided.",
      confirmButtonText: "OK"
    });
    setName("");
    setEmail("");
    setMessage("");
  }

  return (
    <PublicSiteShell
      title="Contact"
      description="Contact the college public relations office, admissions center, and online channels."
    >
      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={5}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <LocationOnOutlinedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>Campus public relations office</Typography>
                      <Typography color="text.secondary">
                        RCAT campus public relations office and admissions center
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <LocalPhoneOutlinedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>Telephone</Typography>
                      <Typography color="text.secondary">(038) 000-000</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <MailOutlineRoundedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>Email</Typography>
                      <Typography color="text.secondary">info@rcat.ac.th</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h3">Follow RCAT</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 2 }}>
                  <Button
                    component="a"
                    href="https://www.facebook.com/"
                    variant="outlined"
                    startIcon={<FacebookRoundedIcon />}
                  >
                    Facebook
                  </Button>
                  <Button
                    component="a"
                    href="https://www.youtube.com/"
                    variant="outlined"
                    startIcon={<YouTubeIcon />}
                  >
                    YouTube
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">Send a Message</Typography>
              <Stack component="form" spacing={2.2} sx={{ mt: 2 }} onSubmit={handleSubmit}>
                <TextField
                  label="Name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="Message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  multiline
                  minRows={6}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" startIcon={<SendOutlinedIcon />}>
                  Send message
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </PublicSiteShell>
  );
}
