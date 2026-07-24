import "server-only";

type ZazzleLinkOptions = {
  memberId: string;
  associateId?: string;
  templateId: string;
  imageParameter: string;
  imageUrl: string;
  imageCode?: string;
};

const ZAZZLE_ID_PATTERN = /^\d{18}$/;
const ZAZZLE_PARAMETER_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;

function zazzleId(name: string, value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  if (!ZAZZLE_ID_PATTERN.test(normalized)) {
    throw new Error(`${name} must be an 18-digit Zazzle ID.`);
  }
  return normalized;
}

export function isZazzlePrintEnabled(): boolean {
  if (process.env.ZAZZLE_PRINT_ENABLED !== "true") return false;
  zazzlePrintEnv();
  return true;
}

export function zazzlePrintEnv() {
  const imageParameter =
    process.env.ZAZZLE_IMAGE_PARAMETER?.trim() || "image1";
  if (!ZAZZLE_PARAMETER_PATTERN.test(imageParameter)) {
    throw new Error(
      "ZAZZLE_IMAGE_PARAMETER must be a valid Zazzle template parameter.",
    );
  }

  const associateId = process.env.ZAZZLE_ASSOCIATE_ID?.trim();
  return {
    memberId: zazzleId("ZAZZLE_MEMBER_ID", process.env.ZAZZLE_MEMBER_ID),
    associateId: associateId
      ? zazzleId("ZAZZLE_ASSOCIATE_ID", associateId)
      : undefined,
    templateId: zazzleId(
      "ZAZZLE_TEMPLATE_ID",
      process.env.ZAZZLE_TEMPLATE_ID,
    ),
    imageParameter,
  };
}

export function buildZazzlePrintUrl(options: ZazzleLinkOptions): string {
  const url = new URL(
    `/api/create/at-${zazzleId("memberId", options.memberId)}`,
    "https://www.zazzle.com",
  );
  url.searchParams.set("ax", "Linkover");
  url.searchParams.set("pd", zazzleId("templateId", options.templateId));
  url.searchParams.set("ed", "false");
  url.searchParams.set("tc", "rarely_print");

  if (options.associateId) {
    url.searchParams.set(
      "rf",
      zazzleId("associateId", options.associateId),
    );
  }
  if (!ZAZZLE_PARAMETER_PATTERN.test(options.imageParameter)) {
    throw new Error("Invalid Zazzle image parameter.");
  }
  if (options.imageCode) {
    url.searchParams.set(
      "ic",
      options.imageCode.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 100),
    );
  }
  url.searchParams.set(
    `t_${options.imageParameter}_iid`,
    new URL(options.imageUrl).toString(),
  );
  return url.toString();
}
