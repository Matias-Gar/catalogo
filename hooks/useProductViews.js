"use client";

import { useCallback, useEffect, useState } from "react";
import { PRODUCT_VIEW_OPTIONS } from "@/lib/productViews";

export function useProductViews() {
  const [productViews, setProductViews] = useState(PRODUCT_VIEW_OPTIONS);
  const [loadingProductViews, setLoadingProductViews] = useState(true);

  const reloadProductViews = useCallback(async () => {
    try {
      const response = await fetch("/api/public/tipos-producto", { cache: "no-store" });
      const result = await response.json();
      if (response.ok && Array.isArray(result?.tipos) && result.tipos.length) setProductViews(result.tipos);
    } catch (_error) {
      setProductViews(PRODUCT_VIEW_OPTIONS);
    } finally {
      setLoadingProductViews(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadProductViews();
  }, [reloadProductViews]);
  return { productViews, loadingProductViews, reloadProductViews };
}
