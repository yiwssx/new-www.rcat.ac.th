import { FormEvent, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import EmptyState from "../../shared/components/EmptyState";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState, { PublicBackgroundProgress } from "../components/PublicLoadingState";
import { PublicPagination } from "../components/PublicPagination";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicSearchIndex } from "../hooks/usePublicSearchIndex";
import { normalizePublicPageSearchValue } from "../routing/searchParams";
import { ContentItem } from "../../types";
import { formatDisplayDate } from "../../utils/dateDisplay";
import { normalizeSafeHref } from "../../utils/safeUrl";
import { interactiveSurfaceSx } from "../../design-system/componentStyles";
import ActionBar from "../../design-system/components/ActionBar";

const SEARCH_PAGE_SIZE = 12;

function getSearchQueryFromLocation(search: Record<string, unknown>) {
  const value = search.q;

  return typeof value === "string" ? value.trim() : "";
}

function getContentTypeLabel(type: ContentItem["type"]) {
  switch (type) {
    case "news":
      return "ข่าว";
    case "announcement":
      return "ประกาศ";
    case "program":
      return "แผนกวิชา";
    case "blog":
      return "บทความ";
    case "page":
      return "หน้าเว็บ";
    default:
      return type;
  }
}

export default function PublicSearchPage() {
  const navigate = useNavigate();
  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const query = getSearchQueryFromLocation(search);
  const hasQuery = Boolean(query);
  const requestedPage = normalizePublicPageSearchValue(search.page) ?? 1;
  const { data, isLoading, isFetching, isError, refetch } = usePublicSearchIndex(
    query,
    requestedPage,
    SEARCH_PAGE_SIZE,
    hasQuery
  );
  const [draftQuery, setDraftQuery] = useState(query);

  const results = data?.items ?? [];
  const fallbackPageCount = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const page = data?.pagination?.page ?? Math.min(requestedPage, fallbackPageCount);
  const pageSize = data?.pagination?.pageSize ?? SEARCH_PAGE_SIZE;
  const pageCount = data?.pagination?.totalPages ?? fallbackPageCount;
  const totalItems = data?.pagination?.totalItems ?? results.length;
  const visibleResults = data?.pagination
    ? results
    : results.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = draftQuery.trim();

    if (!nextQuery) {
      return;
    }

    void navigate({ to: "/search", search: { q: nextQuery } });
  }

  function handlePageChange(nextPage: number) {
    const clampedPage = Math.min(Math.max(1, Math.floor(nextPage)), pageCount);

    void navigate({
      to: "/search",
      search: (previous) => {
        const nextSearch = { ...previous, q: query } as typeof previous & Record<string, unknown>;

        if (clampedPage <= 1) {
          delete nextSearch.page;
        } else {
          nextSearch.page = clampedPage;
        }

        return nextSearch;
      },
      resetScroll: false
    });

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("search-results-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  if (hasQuery && !data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell canonicalPath="/search">
        <PublicLoadingState variant="search-results" />
      </PublicSiteShell>
    );
  }

  if (hasQuery && !data && isError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <PublicSiteShell
      title="ค้นหา"
      description="ผลการค้นหาในเว็บไซต์"
      canonicalPath="/search"
      seoTitle={query ? `ค้นหา: ${query}` : "ค้นหา"}
      seoDescription="ค้นหาเนื้อหา ข่าว ประกาศ แผนกวิชา และบทความในเว็บไซต์"
      preloadedSiteSettings={data?.siteSettings}
      preloadedHomepageSettings={data?.homepageSettings}
      preloadedDisplaySettings={data?.displaySettings}
      preloadedMenu={data?.menu}
    >
      <Card
        component="form"
        onSubmit={handleSubmit}
        sx={{
          mb: 3
        }}
      >
        <CardContent>
          <ActionBar
            ariaLabel="ค้นหาเนื้อหา"
            primary={
              <TextField
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                type="search"
                label="คำค้น"
                placeholder="ค้นหาในเว็บไซต์"
                aria-label="ค้นหาในเว็บไซต์"
                fullWidth
              />
            }
            secondary={
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SearchOutlinedIcon />}
                sx={{ minWidth: { md: 132 } }}
              >
                ค้นหา
              </Button>
            }
          />
        </CardContent>
      </Card>
      <PublicBackgroundProgress active={hasQuery && isFetching} />
      {!query && (
        <EmptyState
          title="ค้นหาเนื้อหาในเว็บไซต์"
          description="กรอกคำค้น เช่น ข่าวสมัครงาน จัดซื้อจัดจ้าง ผลงาน หรือชื่อแผนกวิชา"
          icon={<SearchOutlinedIcon />}
        />
      )}
      {query && !totalItems && (
        <EmptyState
          title="ไม่พบผลการค้นหา"
          description={`ไม่พบเนื้อหาที่ตรงกับ "${query}"`}
          icon={<SearchOutlinedIcon />}
        />
      )}
      {query && totalItems > 0 && (
        <Stack spacing={2.2}>
          <Typography variant="h2" sx={{ fontSize: { xs: "1.35rem", md: "1.75rem" } }}>
            <span id="search-results-heading">
              พบ {totalItems} รายการสำหรับ "{query}"
            </span>
          </Typography>

          <Grid container spacing={2.2}>
            {visibleResults.map((item) => (
              <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    height: "100%",
                    ...interactiveSurfaceSx
                  }}
                >
                  <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 1.4 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{
                        flexWrap: "wrap"
                      }}
                    >
                      <Chip size="small" color="primary" label={getContentTypeLabel(item.type)} />
                      {item.category && <Chip size="small" variant="outlined" label={item.category} />}
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{
                        alignItems: "flex-start"
                      }}
                    >
                      <ArticleOutlinedIcon color="primary" sx={{ mt: 0.35 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          component="a"
                          href={normalizeSafeHref(`/content/${item.slug}`)}
                          sx={{
                            color: "primary.dark",
                            display: "inline-block",
                            fontSize: { xs: "1.12rem", md: "1.22rem" },
                            fontWeight: 900,
                            lineHeight: 1.32,
                            textDecoration: "none",
                            "&:hover": {
                              textDecoration: "underline",
                              textUnderlineOffset: 3
                            }
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            mt: 0.45
                          }}
                        >
                          {formatDisplayDate(item.publishAt)}
                        </Typography>
                      </Box>
                    </Stack>

                    {item.summary && (
                      <Typography
                        sx={{
                          color: "text.secondary",
                          lineHeight: 1.75
                        }}
                      >
                        {item.summary}
                      </Typography>
                    )}

                    {!!item.tags?.length && (
                      <Stack
                        direction="row"
                        spacing={0.75}
                        useFlexGap
                        sx={{
                          flexWrap: "wrap"
                        }}
                      >
                        {item.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} label={`#${tag}`} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    )}

                    <Button
                      component="a"
                      href={normalizeSafeHref(`/content/${item.slug}`)}
                      sx={{ alignSelf: "flex-start", mt: "auto" }}
                    >
                      อ่านต่อ
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <PublicPagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
          />
        </Stack>
      )}
    </PublicSiteShell>
  );
}
