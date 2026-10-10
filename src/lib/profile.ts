import { create } from "zustand";

export type ProfileId = "cove" | "rideshare";

const LAST = "cove-profile-last";
const SEEN = "cove-profile-seen";

function readLast(): ProfileId {
  if (typeof window === "undefined") return "cove";
  return window.localStorage.getItem(LAST) === "rideshare" ? "rideshare" : "cove";
}

function alreadySeen() {
  if (typeof window === "undefined") return true;
  return window.sessionStorage.getItem(SEEN) === "1";
}

type ProfileState = {
  profile: ProfileId;
  gate: boolean;
  hydrate: () => void;
  choose: (id: ProfileId) => void;
  reopen: () => void;
};

export const useProfile = create<ProfileState>((set) => ({
  profile: "cove",
  gate: false,
  hydrate: () => set({ profile: readLast(), gate: !alreadySeen() }),
  choose: (profile) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST, profile);
      window.sessionStorage.setItem(SEEN, "1");
    }
    set({ profile, gate: false });
  },
  reopen: () => set({ gate: true }),
}));

export function clearProfileGate() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SEEN);
}