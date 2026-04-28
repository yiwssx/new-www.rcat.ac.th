import {
  FormEvent,
  useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import YouTubeIcon from "@mui/icons-material/YouTube";
import PublicSiteShell from "../components/PublicSiteShell";
import { appSwal } from "../../utils/swal";

export default function PublicContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await appSwal.fire({
      icon: "success",
      title: "ได้รับข้อความแล้ว",
      text: "งานประชาสัมพันธ์จะติดต่อกลับตามช่องทางที่คุณให้ไว้",
      confirmButtonText: "ตกลง"
    });
    setName("");
    setEmail("");
    setMessage("");
  }

  return (
    <PublicSiteShell
      title="ติดต่อ"
      description="ติดต่อสำนักงานประชาสัมพันธ์ ศูนย์รับสมัคร และช่องทางออนไลน์ของสถานศึกษา"
    >
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <LocationOnOutlinedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>สำนักงานประชาสัมพันธ์</Typography>
                      <Typography color="text.secondary">
                        งานประชาสัมพันธ์และศูนย์รับสมัคร RCAT
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <LocalPhoneOutlinedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>โทรศัพท์</Typography>
                      <Typography color="text.secondary">0 4356 9117</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start">
                    <MailOutlineRoundedIcon color="primary" />
                    <Box>
                      <Typography fontWeight={900}>อีเมล</Typography>
                      <Typography color="text.secondary">saraban@rcat.ac.th</Typography>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h3">ติดตาม RCAT</Typography>
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
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h3">ส่งข้อความ</Typography>
              <Stack component="form" spacing={2.2} sx={{ mt: 2 }} onSubmit={handleSubmit}>
                <TextField
                  label="ชื่อ"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="อีเมล"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                />
                <TextField
                  label="ข้อความ"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  multiline
                  minRows={6}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" startIcon={<SendOutlinedIcon />}>
                  ส่งข้อความ
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </PublicSiteShell>
  );
}
