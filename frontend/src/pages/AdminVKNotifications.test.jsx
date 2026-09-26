import { describe, expect, test } from "vitest";
import { buildRecipientPayload, buildStaffReminderPayload } from "./AdminVKNotifications";

describe("buildRecipientPayload", () => {
  test("sends every switch value when a recipient is created", () => {
    expect(buildRecipientPayload({
      profile_url: " https://vk.com/id123 ",
      is_enabled: false,
      receive_admin_notifications: false,
      receive_schedule_notifications: true,
      teacher_id: 42,
    })).toEqual({
      profile_url: "https://vk.com/id123",
      is_enabled: false,
      receive_admin_notifications: false,
      receive_schedule_notifications: true,
      teacher_id: 42,
    });
  });

  test("does not enable a schedule subscription without a teacher", () => {
    expect(buildRecipientPayload({
      profile_url: "https://vk.com/id123",
      is_enabled: true,
      receive_admin_notifications: true,
      receive_schedule_notifications: true,
      teacher_id: "",
    }).receive_schedule_notifications).toBe(false);
  });

  test("keeps both staff reminder switches and revision explicit", () => {
    expect(buildStaffReminderPayload({
      staff_reminder_revision: 3,
      receive_medical_reminders: false,
      receive_birthday_reminders: true,
    })).toEqual({ revision: 3, medical: false, birthdays: true });
  });
});
