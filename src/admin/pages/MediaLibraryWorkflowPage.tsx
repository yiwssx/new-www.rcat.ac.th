import Stack from "@mui/material/Stack";
import MediaLibraryWorkflowGuide from "../components/MediaLibraryWorkflowGuide";
import MediaPage from "./MediaPage";

export default function MediaLibraryWorkflowPage() {
  return (
    <Stack spacing={3}>
      <MediaLibraryWorkflowGuide />
      <MediaPage />
    </Stack>
  );
}
