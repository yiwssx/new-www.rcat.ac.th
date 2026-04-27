import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { projectSettings } from "../config/projectSettings";
import type { Session } from "../types";
import type { RootState } from "./store";
import { restoreSession } from "../services/auth";

interface AuthState {
  session: Session | null;
}

function getInitialSession() {
  if (typeof window === "undefined") {
    return null;
  }

  return restoreSession(window.localStorage.getItem(projectSettings.storageKeys.session));
}

const initialState: AuthState = {
  session: getInitialSession()
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<Session>) {
      state.session = action.payload;
    },
    sessionEnded(state) {
      state.session = null;
    }
  }
});

export const { sessionEnded, sessionStarted } = authSlice.actions;
export const selectSession = (state: RootState) => state.auth.session;
export default authSlice.reducer;
