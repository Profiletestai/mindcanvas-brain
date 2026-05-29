//apps/web/lib/mcas/scoreMcasV2.ts
export type McasOption = {
  code: string;
  label: string;
  os?: string;
  core?: "C" | "O" | "R" | "E";
  vertical_band?: "1-2" | "3" | "4" | "5-6";
  flag?: string;
};

export type McasQuestion = {
  code: string;
  prompt: string;
  section: "operating_style" | "career_vertical";
  options: McasOption[];
};

export type McasAnswers = Record<string, string>;

const OS_CODES = ["OS1", "OS2", "OS3", "OS4", "OS5", "OS6", "OS7", "OS8"];
const CORE_CODES = ["C", "O", "R", "E"];
const CV_CODES = ["CV1_2", "CV3", "CV4", "CV5_6"];

function extractAnswerCode(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/^[A-D]/);
  return match ? match[0] : raw;
}

function normaliseCvBand(verticalBand?: string): string | null {
  if (verticalBand === "1-2") return "CV1_2";
  if (verticalBand === "3") return "CV3";
  if (verticalBand === "4") return "CV4";
  if (verticalBand === "5-6") return "CV5_6";
  return null;
}

function labelCv(code: string) {
  if (code === "CV1_2") return "CV1–2";
  if (code === "CV5_6") return "CV5–6";
  return code;
}

function toPct(count: number, total: number) {
  if (!total) return 0;
  return Number((count / total).toFixed(4));
}

function rankedDistribution(
  distribution: Record<string, number>,
  labels: Record<string, string> = {}
) {
  return Object.entries(distribution)
    .map(([code, pct]) => ({
      code,
      label: labels[code] || code,
      pct,
    }))
    .sort((a, b) => b.pct - a.pct)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

function readinessInterpretation(flag: string | null, primaryCv: string | null) {
  if (!flag) {
    return {
      code: null,
      label: null,
      interpretation: null,
      validation_status: "not_available",
    };
  }

  if (flag === "overreach_risk") {
    return {
      code: flag,
      label: "Stretching beyond formal scope",
      interpretation:
        primaryCv
          ? `Current Career Vertical is ${labelCv(primaryCv)} with a possible overreach or hidden promotion signal.`
          : "Possible overreach or hidden promotion signal.",
      validation_status: "risk_signal",
    };
  }

  if (flag === "vertical_confidence_low") {
    return {
      code: flag,
      label: "Consolidating current responsibilities",
      interpretation:
        primaryCv
          ? `Current Career Vertical is ${labelCv(primaryCv)} with a consolidation signal.`
          : "Consolidation phase.",
      validation_status: "consolidation",
    };
  }

  if (flag === "vertical_confidence_matched") {
    return {
      code: flag,
      label: "Comfortable within current scope",
      interpretation:
        primaryCv
          ? `Current Career Vertical is ${labelCv(primaryCv)} and readiness appears matched to current scope.`
          : "Vertical confidence matched.",
      validation_status: "aligned",
    };
  }

  if (flag === "vertical_readiness_signal") {
    return {
      code: flag,
      label: "Ready for broader responsibility",
      interpretation:
        primaryCv
          ? `Current Career Vertical is ${labelCv(primaryCv)} with a possible progression readiness signal.`
          : "Progression readiness signal.",
      validation_status: "progression_ready",
    };
  }

  return {
    code: flag,
    label: flag,
    interpretation: "Readiness flag captured.",
    validation_status: "captured",
  };
}

export function scoreMcasV2(params: {
  answers: McasAnswers;
  questions: McasQuestion[];
  osLabels?: Record<string, string>;
  coreLabels?: Record<string, string>;
  cvLabels?: Record<string, string>;
}) {
  const { answers, questions } = params;

  const osLabels = params.osLabels || {};
  const coreLabels = params.coreLabels || {
    C: "Create",
    O: "Organise",
    R: "Resolve",
    E: "Examine",
  };
  const cvLabels = params.cvLabels || {};

  const questionMap = new Map<string, McasQuestion>();
  for (const question of questions) {
    questionMap.set(question.code, question);
  }

  const osCounts: Record<string, number> = Object.fromEntries(
    OS_CODES.map((code) => [code, 0])
  );

  const coreCounts: Record<string, number> = Object.fromEntries(
    CORE_CODES.map((code) => [code, 0])
  );

  const cvCounts: Record<string, number> = Object.fromEntries(
    CV_CODES.map((code) => [code, 0])
  );

  const audit: Array<{
    question_code: string;
    option_code: string;
    prompt: string;
    option_label: string;
    mapped_os?: string | null;
    mapped_core?: string | null;
    mapped_cv?: string | null;
    flag?: string | null;
  }> = [];

  let readinessFlag: string | null = null;

  for (let i = 1; i <= 25; i++) {
    const questionCode = `Q${i}`;
    const selectedCode = extractAnswerCode(answers[questionCode]);

    if (!selectedCode) {
      throw new Error(`Missing answer for ${questionCode}`);
    }

    const question = questionMap.get(questionCode);

    if (!question) {
      throw new Error(`Question ${questionCode} missing in framework`);
    }

    const option = question.options.find((item) => item.code === selectedCode);

    if (!option) {
      throw new Error(`Invalid answer ${selectedCode} for ${questionCode}`);
    }

    if (i <= 15) {
      if (!option.os) {
        throw new Error(`Missing OS mapping for ${questionCode}:${selectedCode}`);
      }

      if (!option.core) {
        throw new Error(
          `Missing behavioural approach mapping for ${questionCode}:${selectedCode}`
        );
      }

      osCounts[option.os] = (osCounts[option.os] || 0) + 1;
      coreCounts[option.core] = (coreCounts[option.core] || 0) + 1;

      audit.push({
        question_code: questionCode,
        option_code: selectedCode,
        prompt: question.prompt,
        option_label: option.label,
        mapped_os: option.os,
        mapped_core: option.core,
        mapped_cv: null,
        flag: null,
      });
    } else if (i >= 16 && i <= 24) {
      const cvCode = normaliseCvBand(option.vertical_band);

      if (!cvCode) {
        throw new Error(`Missing CV mapping for ${questionCode}:${selectedCode}`);
      }

      cvCounts[cvCode] = (cvCounts[cvCode] || 0) + 1;

      audit.push({
        question_code: questionCode,
        option_code: selectedCode,
        prompt: question.prompt,
        option_label: option.label,
        mapped_os: null,
        mapped_core: null,
        mapped_cv: cvCode,
        flag: null,
      });
    } else if (i === 25) {
      readinessFlag = option.flag || null;

      audit.push({
        question_code: questionCode,
        option_code: selectedCode,
        prompt: question.prompt,
        option_label: option.label,
        mapped_os: null,
        mapped_core: null,
        mapped_cv: null,
        flag: readinessFlag,
      });
    }
  }

  const osDistribution = Object.fromEntries(
    OS_CODES.map((code) => [code, toPct(osCounts[code] || 0, 15)])
  );

  const behaviouralApproachDistribution = Object.fromEntries(
    CORE_CODES.map((code) => [code, toPct(coreCounts[code] || 0, 15)])
  );

  const careerVerticalDistribution = Object.fromEntries(
    CV_CODES.map((code) => [code, toPct(cvCounts[code] || 0, 9)])
  );

  const operatingStyleRanking = rankedDistribution(osDistribution, osLabels);
  const behaviouralApproachRanking = rankedDistribution(
    behaviouralApproachDistribution,
    coreLabels
  );

  const careerVerticalRanking = rankedDistribution(
    careerVerticalDistribution,
    Object.fromEntries(CV_CODES.map((code) => [code, labelCv(code)]))
  );

  const primaryOperatingStyle = operatingStyleRanking[0] || null;
  const secondaryOperatingStyle = operatingStyleRanking[1] || null;
  const tertiaryOperatingStyle = operatingStyleRanking[2] || null;

  const primaryCareerVertical = careerVerticalRanking[0] || null;
  const secondaryCareerVertical = careerVerticalRanking[1] || null;

  const readiness = readinessInterpretation(
    readinessFlag,
    primaryCareerVertical?.code || null
  );

  return {
    model_version: "mcas-v2-distribution",

    operating_style_counts: osCounts,
    operating_style_distribution: osDistribution,
    operating_style_ranking: operatingStyleRanking,

    primary_operating_style: primaryOperatingStyle,
    secondary_operating_style: secondaryOperatingStyle,
    tertiary_operating_style: tertiaryOperatingStyle,

    behavioural_approach_counts: coreCounts,
    behavioural_approach_distribution: behaviouralApproachDistribution,
    behavioural_approach_ranking: behaviouralApproachRanking,

    career_vertical_counts: cvCounts,
    career_vertical_distribution: careerVerticalDistribution,
    career_vertical_ranking: careerVerticalRanking,

    primary_career_vertical: primaryCareerVertical,
    secondary_career_vertical: secondaryCareerVertical,

    readiness_signal: readiness,

    // Backward compatibility
    core_distribution: behaviouralApproachDistribution,
    career_vertical: primaryCareerVertical
      ? {
          code: primaryCareerVertical.code,
          label: primaryCareerVertical.label,
          pct: primaryCareerVertical.pct,
        }
      : null,

    confidence: {
      rating: "distribution_based",
      signals: {
        answered_count: 25,
        os_valid_selections: 15,
        behavioural_approach_valid_selections: 15,
        career_vertical_valid_selections: 9,
        q25_flag: readinessFlag,
      },
    },

    audit: {
      answers: audit,
    },
  };
}