import { Clock3, Sparkles, Workflow } from "lucide-react";
import TimelineTab from "./TimelineTab";
import ChatTab from "./ChatTab";
import DigitalHumanTab from "./DigitalHumanTab";

export const APP_TABS = [
  {
    id: "timeline",
    label: "操作时序轴",
    icon: Clock3,
    component: TimelineTab,
  },
  {
    id: "chat",
    label: "运营助手",
    icon: Workflow,
    component: ChatTab,
  },
  {
    id: "digital-human",
    label: "数字人",
    icon: Sparkles,
    component: DigitalHumanTab,
  },
];
