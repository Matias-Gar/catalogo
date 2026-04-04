import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { createCashMovement } from "@/services/cash.service";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export async function POST(request) {
  try {
    const loggedUserId = await getUserIdFromRequest(request);
    if (!loggedUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const movement = await createCashMovement(getSupabaseServerClient(), {
      ...body,
      user_id: loggedUserId,
    });
    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create cash movement",
      },
      { status: 400 }
    );
  }
}
