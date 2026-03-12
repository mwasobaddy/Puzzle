import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
export const useUserSubscription = (userId) => {
    const [subscription, setSubscription] = useState({ planId: "free", status: "inactive" });
  
    useEffect(() => {
      if (!userId || !db) return;
  
      const subscriptionRef = doc(db, "subscriptions", userId);
      const unsubscribe = onSnapshot(subscriptionRef, (docSnap) => {
        if (docSnap.exists()) {
          setSubscription(docSnap.data());
        } else {
          setSubscription({ planId: "free", status: "inactive" });
        }
      });
  
      return () => unsubscribe();
    }, [userId, db]);
  
    return subscription;
  };
  
export default useUserSubscription;