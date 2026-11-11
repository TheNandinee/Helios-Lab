"use client";

import { Component, type ReactNode } from "react";
import { useLabStore } from "@/store/useLabStore";

interface Props { children: ReactNode; }
interface State { failed: boolean; }

export default class BenchErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("3D bench crashed:", error);
    useLabStore.getState().setViewMode("2d", `3D renderer error: ${error.message}`);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}