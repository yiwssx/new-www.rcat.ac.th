import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Card, CardContent, Chip, Grid, LinearProgress, Stack, Typography } from "@mui/material";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import PublicContentCard from "../components/PublicContentCard";
import PublicSiteShell from "../components/PublicSiteShell";
import { getCmsSnapshot } from "../services/googleApi";

const departments = [
  {
    title: "Engineering Technology",
    description:
      "Automation, robotics, electronics, prototype development, and applied engineering practice.",
    icon: <EngineeringOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["Robotics", "Automation", "Electronics"]
  },
  {
    title: "Digital Business",
    description:
      "Marketing, entrepreneurship, analytics, digital tools, and practical business systems.",
    icon: <AutoStoriesOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["Marketing", "Analytics", "Enterprise"]
  },
  {
    title: "Student Development",
    description:
      "Guidance, activity programs, portfolio preparation, learner support, and career readiness.",
    icon: <GroupsOutlinedIcon sx={{ fontSize: 42 }} />,
    tags: ["Guidance", "Activities", "Career"]
  }
];

export default function PublicDepartmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["cms-snapshot"],
    queryFn: getCmsSnapshot
  });

  const programItems = useMemo(
    () =>
      (data?.content ?? [])
        .filter((item) => item.type === "program" && (item.status === "published" || item.status === "scheduled"))
        .sort((left, right) => new Date(right.publishAt).getTime() - new Date(left.publishAt).getTime()),
    [data]
  );

  return (
    <PublicSiteShell
      title="Departments"
      description="Academic departments, learning pathways, and program profiles published from the CMS."
    >
      {isLoading && <LinearProgress sx={{ mb: 3 }} />}
      <Grid container spacing={2.5}>
        {departments.map((department) => (
          <Grid item xs={12} md={4} key={department.title}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ p: 3 }}>
                <Box
                  sx={{
                    width: 68,
                    height: 68,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "primary.light",
                    color: "primary.main",
                    mb: 2
                  }}
                >
                  {department.icon}
                </Box>
                <Typography variant="h3">{department.title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1.2 }}>
                  {department.description}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  {department.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
          <SchoolOutlinedIcon color="primary" />
          <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
            Program Profiles
          </Typography>
        </Stack>
        <Grid container spacing={2.5}>
          {programItems.map((item) => (
            <Grid item xs={12} md={6} key={item.id}>
              <PublicContentCard item={item} mediaAssets={data?.media ?? []} icon={<SchoolOutlinedIcon sx={{ fontSize: 42 }} />} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </PublicSiteShell>
  );
}
