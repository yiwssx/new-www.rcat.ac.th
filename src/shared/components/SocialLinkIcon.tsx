import Avatar from "@mui/material/Avatar";
import FacebookIcon from "@mui/icons-material/Facebook";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import { socialHttpsUrl, type SocialIconKey } from "../../features/cms-settings/socialWidget";

const iconComponents = {
  facebook: FacebookIcon,
  school: SchoolOutlinedIcon,
  computer: ComputerOutlinedIcon,
  business: BusinessOutlinedIcon,
  campaign: CampaignOutlinedIcon,
  groups: GroupsOutlinedIcon,
  calendar: EventOutlinedIcon,
  public: PublicOutlinedIcon,
  work: WorkOutlineIcon,
  link: LinkOutlinedIcon,
  custom: LinkOutlinedIcon
};

export default function SocialLinkIcon({
  iconKey, iconUrl, label
}: { iconKey: SocialIconKey; iconUrl?: string; label: string }) {
  const safeImage = iconKey === "custom" ? socialHttpsUrl(iconUrl) : "";
  if (safeImage) {
    return <Avatar alt={label} src={safeImage} variant="rounded" sx={{ width: 30, height: 30 }} />;
  }
  const IconComponent = iconComponents[iconKey] ?? LinkOutlinedIcon;
  return <IconComponent aria-hidden="true" fontSize="small" color={iconKey === "facebook" ? "primary" : "action"} />;
}
