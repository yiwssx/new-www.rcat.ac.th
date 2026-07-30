import { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DashboardMetric } from "../../types";

interface MetricCardProps {
  metric: DashboardMetric;
  icon: ReactNode;
}

export default function MetricCard({ metric, icon }: MetricCardProps) {
  const theme = useTheme();
  const toneStyles: Record<DashboardMetric["tone"], { background: string; color: string }> = {
    blue: {
      background: theme.palette.primary.light,
      color: theme.palette.primary.main
    },
    green: {
      background: theme.palette.success.light,
      color: theme.palette.success.main
    },
    amber: {
      background: theme.palette.secondary.light,
      color: theme.palette.secondary.dark
    },
    red: {
      background: theme.palette.error.light,
      color: theme.palette.error.main
    }
  };
  const tone = toneStyles[metric.tone];

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: "flex-start"
          }}
        >
          <Box>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary"
              }}
            >
              {metric.label}
            </Typography>
            <Typography variant="h2" sx={{ mt: 1 }}>
              {metric.value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              color: tone.color,
              background: tone.background
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mt: 2
          }}
        >
          {metric.trend}
        </Typography>
      </CardContent>
    </Card>
  );
}
