import { Bot, TrendingUp, Globe, Sparkles, Users, UserCircle2, NotebookPen, Landmark } from "lucide-react";
import { useI18n } from "@/i18n";
import type { NestedKeyOf } from "@/i18n/types";
import type { Translation } from "@/i18n/locales/zh";

type I18nKey = NestedKeyOf<Translation>;

type ExampleKey = {
  titleKey: I18nKey;
  descKey: I18nKey;
  promptKey: I18nKey;
};

interface Category {
  labelKey: I18nKey;
  icon: React.ReactNode;
  color: string;
  examples: ExampleKey[];
}

const CATEGORIES: Category[] = [
  {
    labelKey: "chat.welcome.groupBacktest",
    icon: <TrendingUp className="h-4 w-4" />,
    color: "text-red-400 border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5",
    examples: [
      {
        titleKey: "chat.welcome.crossMarketTitle",
        descKey: "chat.welcome.crossMarketDesc",
        promptKey: "chat.welcome.crossMarketPrompt",
      },
      {
        titleKey: "chat.welcome.btcMacdTitle",
        descKey: "chat.welcome.btcMacdDesc",
        promptKey: "chat.welcome.btcMacdPrompt",
      },
      {
        titleKey: "chat.welcome.usTechTitle",
        descKey: "chat.welcome.usTechDesc",
        promptKey: "chat.welcome.usTechPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupResearch",
    icon: <Sparkles className="h-4 w-4" />,
    color: "text-amber-400 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
    examples: [
      {
        titleKey: "chat.welcome.multiFactorTitle",
        descKey: "chat.welcome.multiFactorDesc",
        promptKey: "chat.welcome.multiFactorPrompt",
      },
      {
        titleKey: "chat.welcome.optionsGreeksTitle",
        descKey: "chat.welcome.optionsGreeksDesc",
        promptKey: "chat.welcome.optionsGreeksPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupSwarm",
    icon: <Users className="h-4 w-4" />,
    color: "text-violet-400 border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5",
    examples: [
      {
        titleKey: "chat.welcome.investCommitteeTitle",
        descKey: "chat.welcome.investCommitteeDesc",
        promptKey: "chat.welcome.investCommitteePrompt",
      },
      {
        titleKey: "chat.welcome.quantDeskTitle",
        descKey: "chat.welcome.quantDeskDesc",
        promptKey: "chat.welcome.quantDeskPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupDoc",
    icon: <Globe className="h-4 w-4" />,
    color: "text-blue-400 border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5",
    examples: [
      {
        titleKey: "chat.welcome.earningsTitle",
        descKey: "chat.welcome.earningsDesc",
        promptKey: "chat.welcome.earningsPrompt",
      },
      {
        titleKey: "chat.welcome.webMacroTitle",
        descKey: "chat.welcome.webMacroDesc",
        promptKey: "chat.welcome.webMacroPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupJournal",
    icon: <NotebookPen className="h-4 w-4" />,
    color: "text-orange-400 border-orange-500/30 hover:border-orange-500/60 hover:bg-orange-500/5",
    examples: [
      {
        titleKey: "chat.welcome.brokerExportTitle",
        descKey: "chat.welcome.brokerExportDesc",
        promptKey: "chat.welcome.brokerExportPrompt",
      },
      {
        titleKey: "chat.welcome.behaviorBiasTitle",
        descKey: "chat.welcome.behaviorBiasDesc",
        promptKey: "chat.welcome.behaviorBiasPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupConnectors",
    icon: <Landmark className="h-4 w-4" />,
    color: "text-cyan-400 border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/5",
    examples: [
      {
        titleKey: "chat.welcome.checkConnectorTitle",
        descKey: "chat.welcome.checkConnectorDesc",
        promptKey: "chat.welcome.checkConnectorPrompt",
      },
      {
        titleKey: "chat.welcome.connectorPortfolioTitle",
        descKey: "chat.welcome.connectorPortfolioDesc",
        promptKey: "chat.welcome.connectorPortfolioPrompt",
      },
      {
        titleKey: "chat.welcome.quoteTrendTitle",
        descKey: "chat.welcome.quoteTrendDesc",
        promptKey: "chat.welcome.quoteTrendPrompt",
      },
    ],
  },
  {
    labelKey: "chat.welcome.groupShadow",
    icon: <UserCircle2 className="h-4 w-4" />,
    color: "text-emerald-400 border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
    examples: [
      {
        titleKey: "chat.welcome.trainShadowTitle",
        descKey: "chat.welcome.trainShadowDesc",
        promptKey: "chat.welcome.trainShadowPrompt",
      },
      {
        titleKey: "chat.welcome.shadowDeltaTitle",
        descKey: "chat.welcome.shadowDeltaDesc",
        promptKey: "chat.welcome.shadowDeltaPrompt",
      },
      {
        titleKey: "chat.welcome.shadowReportTitle",
        descKey: "chat.welcome.shadowReportDesc",
        promptKey: "chat.welcome.shadowReportPrompt",
      },
    ],
  },
];

const CAPABILITY_CHIPS: readonly I18nKey[] = [
  "chat.welcome.chipSkills",
  "chat.welcome.chipSwarm",
  "chat.welcome.chipTools",
  "chat.welcome.chipMarkets",
  "chat.welcome.chipConnectors",
  "chat.welcome.chipTimeframes",
  "chat.welcome.chipOptimizers",
  "chat.welcome.chipRisk",
  "chat.welcome.chipOptions",
  "chat.welcome.chipPdfWeb",
  "chat.welcome.chipFactor",
  "chat.welcome.chipJournal",
  "chat.welcome.chipShadow",
  "chat.welcome.chipMemory",
  "chat.welcome.chipSearch",
];

interface Props {
  onExample: (s: string) => void;
}

export function WelcomeScreen({ onExample }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
      {/* Header */}
      <div className="space-y-3">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/80 to-info/80 flex items-center justify-center shadow-lg">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vibe-Trading</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
            {t("chat.welcome.subtitle")}
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed mx-auto">
            {t("chat.welcome.cta")}
          </p>
        </div>
      </div>

      {/* Capability chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {CAPABILITY_CHIPS.map((key) => (
          <span
            key={key}
            className="px-2.5 py-1 text-xs rounded-full border border-border/60 text-muted-foreground bg-muted/30"
          >
            {t(key)}
          </span>
        ))}
      </div>

      {/* Example categories grid */}
      <div className="w-full max-w-2xl text-left space-y-4">
        <p className="text-xs text-muted-foreground px-1">{t("chat.welcome.tryExample")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <div key={cat.labelKey} className="space-y-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-1 ${cat.color.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                {cat.icon}
                <span>{t(cat.labelKey)}</span>
              </div>
              <div className="space-y-1.5">
                {cat.examples.map((ex) => (
                  <button
                    key={ex.titleKey}
                    onClick={() => onExample(t(ex.promptKey))}
                    className={`block w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${cat.color}`}
                  >
                    <span className="text-sm font-medium text-foreground leading-snug">
                      {t(ex.titleKey)}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">
                      {ex.descKey === "chat.welcome.brokerExportDesc"
                        ? t(ex.descKey, { sources: "同花顺/东财/富途" })
                        : t(ex.descKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
