"use client";
import PerfilForm from "../../../components/PerfilForm";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/SupabaseClient";

export default function PerfilPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
    };
    getUser();
  }, []);

  if (!user) {
    return <div className="p-8 text-center text-gray-700">Cargando usuario...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <PerfilForm userId={user.id} />
    </div>
  );
}
