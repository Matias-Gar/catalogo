import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { listCashClosures } from "@/services/cash.service";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export async function GET(request) {
  try {
    const loggedUserId = await getUserIdFromRequest(request);
    if (!loggedUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const closures = await listCashClosures(getSupabaseServerClient(), {
      limit: searchParams.get("limit"),
      user_id: loggedUserId,
      cashbox_id: searchParams.get("cashbox_id") || "main",
    });

    return NextResponse.json({ success: true, data: closures });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to list cash closures",
      },
      { status: 400 }
    );
  }
}
