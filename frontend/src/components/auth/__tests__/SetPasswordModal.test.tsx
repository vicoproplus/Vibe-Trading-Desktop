import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetPasswordModal } from "../SetPasswordModal";
import { apiUser } from "@/lib/apiUser";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("SetPasswordModal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(<SetPasswordModal open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows title when open", () => {
    render(<SetPasswordModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/设置登录密码|Set login password/)).toBeInTheDocument();
  });

  it("rejects mismatched passwords without calling api", async () => {
    const spy = vi.spyOn(apiUser, "setPassword").mockResolvedValue(undefined);
    render(<SetPasswordModal open={true} onClose={vi.fn()} />);
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    await userEvent.type(pwdInputs[0], "secret123");
    await userEvent.type(pwdInputs[1], "secret999");
    const submit = screen.getByRole("button", { name: /设置密码|Set password/ });
    await userEvent.click(submit);
    expect(spy).not.toHaveBeenCalled();
  });

  it("submits and closes on success", async () => {
    const spy = vi.spyOn(apiUser, "setPassword").mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<SetPasswordModal open={true} onClose={onClose} />);
    const pwdInputs = document.querySelectorAll('input[type="password"]');
    await userEvent.type(pwdInputs[0], "secret123");
    await userEvent.type(pwdInputs[1], "secret123");
    await userEvent.click(screen.getByRole("button", { name: /设置密码|Set password/ }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("secret123"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
