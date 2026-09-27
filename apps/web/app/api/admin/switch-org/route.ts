// apps/web/app/api/admin/switch-org/route.ts
import { NextResponse } from "next/server";

import { requireSuperadminApi } from "@/lib/server/adminApiAuth";

const COOKIE_NAME = "active_org_id";

export async function POST(req: Request) {
  try {
    const auth = await requireSuperadminApi();

    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: auth.error,
        },
        {
          status: auth.status,
        }
      );
    }

    const contentType =
      req.headers.get("content-type") || "";

    let orgId = "";
    let mode = "switch";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      const body = await req
        .json()
        .catch(() => ({}));

      orgId = String(
        body?.orgId || ""
      ).trim();

      mode = String(
        body?.mode || "switch"
      ).trim();
    } else {
      const form = await req.formData();

      orgId = String(
        form.get("orgId") || ""
      ).trim();

      mode = String(
        form.get("mode") || "switch"
      ).trim();
    }

    const backTo = "/admin";

    if (mode === "clear") {
      const res = NextResponse.redirect(
        new URL(backTo, req.url)
      );

      res.cookies.set(
        COOKIE_NAME,
        "",
        {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          maxAge: 0,
        }
      );

      return res;
    }

    if (!orgId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing orgId",
        },
        {
          status: 400,
        }
      );
    }

    const res = NextResponse.redirect(
      new URL(backTo, req.url)
    );

    res.cookies.set(
      COOKIE_NAME,
      orgId,
      {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return res;
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(
          e?.message || e
        ),
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(req: Request) {
  const auth = await requireSuperadminApi();

  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
      },
      {
        status: auth.status,
      }
    );
  }

  const url = new URL(req.url);
  const shouldClear =
    url.searchParams.get("clear");

  const res = NextResponse.redirect(
    new URL("/admin", req.url)
  );

  if (shouldClear) {
    res.cookies.set(
      COOKIE_NAME,
      "",
      {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 0,
      }
    );
  }

  return res;
}
