import { useEffect, useCallback, useState, createContext, useContext, useRef } from "react";

const LeaveBlockerContext = createContext(null);

export function LeaveBlockerProvider({ shouldBlock, children }) {
  const [showModal, setShowModal] = useState(false);
  const confirmFnRef = useRef(null);
  const pushedRef = useRef(false);
  const shouldBlockRef = useRef(shouldBlock);

  shouldBlockRef.current = shouldBlock;

  // beforeunload for tab close / refresh
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);

  // popstate for browser back/forward
  useEffect(() => {
    if (!shouldBlock) {
      pushedRef.current = false;
      return;
    }

    const onPopState = () => {
      pushedRef.current = false;
      confirmFnRef.current = () => window.history.back();
      setShowModal(true);
    };

    window.addEventListener("popstate", onPopState);
    if (!pushedRef.current) {
      window.history.pushState("", "", window.location.pathname);
      pushedRef.current = true;
    }

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [shouldBlock]);

  // called by header links / programmatic navigation
  // uses ref for shouldBlock so it always reads the latest value
  const requestLeave = useCallback(
    (confirmFn) => {
      if (!shouldBlockRef.current) {
        confirmFn();
        return;
      }
      confirmFnRef.current = confirmFn;
      setShowModal(true);
    },
    []
  );

  const confirmLeave = useCallback(() => {
    setShowModal(false);
    const fn = confirmFnRef.current;
    confirmFnRef.current = null;
    if (fn) fn();
  }, []);

  const cancelLeave = useCallback(() => {
    setShowModal(false);
    confirmFnRef.current = null;
    if (!pushedRef.current) {
      window.history.pushState("", "", window.location.pathname);
      pushedRef.current = true;
    }
  }, []);

  return (
    <LeaveBlockerContext.Provider
      value={{ showModal, confirmLeave, cancelLeave, requestLeave }}
    >
      {children}
    </LeaveBlockerContext.Provider>
  );
}

export function useLeaveConfirmation() {
  return useContext(LeaveBlockerContext);
}
