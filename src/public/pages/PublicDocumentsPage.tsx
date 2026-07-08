import { useMemo, useState } from "react";
import { Box, Button, InputAdornment, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { DocumentListCard } from "../../features/public-documents";
import PublicErrorState from "../components/PublicErrorState";
import PublicLoadingState from "../components/PublicLoadingState";
import PublicSiteShell from "../components/PublicSiteShell";
import { usePublicDocumentList } from "../hooks/usePublicDocumentList";

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("th-TH");
}

export default function PublicDocumentsPage() {
  const { data, isLoading, isFetching, isError, refetch } = usePublicDocumentList();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const documents = useMemo(() => data?.items ?? [], [data?.items]);
  const categories = useMemo(
    () =>
      Array.from(new Set(documents.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [documents]
  );
  const normalizedSearch = normalizeText(searchQuery);
  const filteredDocuments = useMemo(
    () =>
      documents.filter((item) => {
        const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
        const searchableText = normalizeText([item.title, item.category, item.fileName].join(" "));
        const matchesSearch = normalizedSearch ? searchableText.includes(normalizedSearch) : true;

        return matchesCategory && matchesSearch;
      }),
    [categoryFilter, documents, normalizedSearch]
  );
  const hasActiveFilter = Boolean(normalizedSearch || categoryFilter);

  if (!data && (isLoading || isFetching)) {
    return (
      <PublicSiteShell title="เอกสารเผยแพร่" description="เอกสารและไฟล์เผยแพร่สำหรับประชาชน">
        <PublicLoadingState />
      </PublicSiteShell>
    );
  }

  if (!data && isError) {
    return (
      <PublicErrorState
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isFetching}
      />
    );
  }

  if (!data) {
    return (
      <PublicSiteShell title="เอกสารเผยแพร่" description="เอกสารและไฟล์เผยแพร่สำหรับประชาชน">
        <PublicLoadingState />
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell
      title="เอกสารเผยแพร่"
      description="รวมเอกสารประกาศ แผนงาน คู่มือ และไฟล์เผยแพร่ของสถานศึกษา"
      seoTitle="เอกสารเผยแพร่"
      seoDescription="เอกสารเผยแพร่ของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด"
      canonicalPath="/documents"
    >
      {isFetching && <LinearProgress sx={{ mb: 3 }} />}
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
        <DescriptionOutlinedIcon color="primary" />
        <Typography variant="h2" sx={{ fontSize: "1.65rem" }}>
          เอกสารทั้งหมด
        </Typography>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
        <TextField
          type="search"
          label="ค้นหาเอกสารเผยแพร่"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          inputProps={{ "aria-label": "ค้นหาเอกสารเผยแพร่" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ flex: "1 1 360px" }}
        />
        <TextField
          select
          label="หมวดหมู่"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          inputProps={{ "aria-label": "กรองหมวดหมู่เอกสาร" }}
          sx={{ minWidth: { xs: "100%", md: 220 } }}
        >
          <MenuItem value="">ทุกหมวดหมู่</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
            </MenuItem>
          ))}
        </TextField>
        {hasActiveFilter && (
          <Button
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("");
            }}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </Stack>
      <Box sx={{ mt: 2.5 }}>
        <DocumentListCard
          items={filteredDocuments}
          emptyTitle={hasActiveFilter ? "ไม่พบเอกสารตามคำค้นหาหรือตัวกรองที่เลือก" : "ยังไม่มีเอกสารเผยแพร่"}
        />
      </Box>
    </PublicSiteShell>
  );
}
