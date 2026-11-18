import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileView } from "@/components/members/profile-view";
import type { MemberProfile } from "@/lib/services/member-profile";

const profile: MemberProfile = {
  id: "m1",
  name: "Ali Khan",
  isSelf: false,
  isAlumnus: false,
  avatarUrl: null,
  batch: 2023,
  programme: "BS Computer Science",
  department: "Computer Science",
  semester: 7,
  bio: "Ask me about databases",
  field: null,
  company: null,
  availableToAdvise: true,
  skills: ["React", "SQL"],
  courses: [
    { code: "CSE341", title: "Database Systems", canAdvise: true },
    { code: "MTS211", title: "Linear Algebra", canAdvise: false },
  ],
  connected: false,
  email: null,
};

describe("ProfileView (US2.6)", () => {
  it("TC-046: shows the profile details, skills, courses and advise badge", () => {
    render(<ProfileView profile={profile} />);
    expect(screen.getByRole("heading", { name: "Ali Khan" })).toBeInTheDocument();
    expect(screen.getByText("BS Computer Science · Computer Science · Batch 2023 · Semester 7")).toBeInTheDocument();
    expect(screen.getByText("Available to advise")).toBeInTheDocument();
    expect(screen.getByText("for CSE341")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Skills" })).toHaveTextContent("ReactSQL");
    expect(screen.getByText("Can advise")).toBeInTheDocument();
    expect(screen.getByText(/self-declared/)).toBeInTheDocument();
  });

  it("TC-045: says the email is hidden when not connected", () => {
    render(<ProfileView profile={profile} />);
    expect(screen.getByText("Email hidden until you are connected")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("TC-067: shows the email for a connection", () => {
    render(<ProfileView profile={{ ...profile, connected: true, email: "ali@khi.iba.edu.pk" }} />);
    expect(screen.getByRole("link", { name: "ali@khi.iba.edu.pk" })).toHaveAttribute("href", "mailto:ali@khi.iba.edu.pk");
  });

  it("offers an edit link on your own profile", () => {
    render(<ProfileView profile={{ ...profile, isSelf: true, email: "me@khi.iba.edu.pk" }} />);
    expect(screen.getByRole("link", { name: "Edit your profile" })).toHaveAttribute("href", "/profile/edit");
  });
});
