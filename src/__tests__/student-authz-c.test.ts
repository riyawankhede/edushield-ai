/**
 * Service authorization: admin + counselor + hygiene.
 */
import { StudentService } from "@/services/student.service";
import { Student, Admin, Counselor } from "@/models";
jest.mock("@/lib/db", () => ({ connectDB: jest.fn() }));
jest.mock("@/services/teacher.service", () => ({
  TeacherService: { resolveTeacherByUserId: jest.fn(), getAssignedScope: jest.fn() },
}));
jest.mock("@/models", () => ({
  Student: { findOne: jest.fn() },
  Parent: { findOne: jest.fn() },
  ParentStudentRelationship: { findOne: jest.fn() },
  Admin: { findOne: jest.fn() },
  Counselor: { findOne: jest.fn() },
  Class: { findOne: jest.fn() },
}));
const MStudent = Student as unknown as { findOne: jest.Mock };
const MAdmin = Admin as unknown as { findOne: jest.Mock };
const MCounselor = Counselor as unknown as { findOne: jest.Mock };
const SA = "64a1b2c3d4e5f6a7b8c9d0e0";
const SD = "64a1b2c3d4e5f6a7b8c9d0f3";
const FS = "64a1b2c3d4e5f6a7b8c9d0fe";
const CA = "64a1b2c3d4e5f6a7b8c9d0f2";
const AU = "64a1b2c3d4e5f6a7b8c9d0e5";
const AD = "64a1b2c3d4e5f6a7b8c9d0d5";
const CU = "64a1b2c3d4e5f6a7b8c9d0e6";
const CD = "64a1b2c3d4e5f6a7b8c9d0d6";
const TU = "64a1b2c3d4e5f6a7b8c9d0e4";
const PROF = { _id: SD, firstName: "Aarav", schoolId: SA, classId: CA, isActive: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => ({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(v) }), lean: jest.fn().mockResolvedValue(v) });
async function denied(p: Promise<unknown>) { await expect(p).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 }); }
beforeEach(() => { jest.clearAllMocks(); });
describe("admin role scope", () => {
  it("same-school student allowed", async () => {
    const { Class } = jest.requireMock("@/models") as { Class: { findOne: jest.Mock } };
    MAdmin.findOne.mockReturnValue(one({ _id: AD }));
    MStudent.findOne.mockReturnValue(one(PROF));
    Class.findOne.mockReturnValue(one({ _id: CA }));
    const out = await StudentService.getAuthorizedStudentProfile({ userId: AU, role: "admin", schoolId: SA }, SD);
    expect(out).toMatchObject({ firstName: "Aarav" });
    expect(MAdmin.findOne).toHaveBeenCalledWith({ userId: AU, schoolId: SA, isActive: true });
    expect(MStudent.findOne).toHaveBeenCalledWith({ _id: SD, schoolId: SA, isActive: true });
  });
  it("other-school student denied", async () => {
    MAdmin.findOne.mockReturnValue(one(null));
    await denied(StudentService.getAuthorizedStudentProfile({ userId: AU, role: "admin", schoolId: SA }, FS));
  });
});
describe("counselor safe denial", () => {
  it("same-school counselor denied", async () => {
    MCounselor.findOne.mockReturnValue(one({ _id: CD }));
    await denied(StudentService.getAuthorizedStudentProfile({ userId: CU, role: "counselor", schoolId: SA }, SD));
    expect(MCounselor.findOne).toHaveBeenCalledWith({ userId: CU, schoolId: SA, isActive: true });
  });
  it("unknown counselor denied", async () => {
    MCounselor.findOne.mockReturnValue(one(null));
    await denied(StudentService.getAuthorizedStudentProfile({ userId: CU, role: "counselor", schoolId: SA }, SD));
  });
});
describe("scope hygiene", () => {
  it("invalid id denied", async () => {
    await denied(StudentService.getAuthorizedStudentProfile({ userId: TU, role: "teacher", schoolId: SA }, "not-an-object-id"));
  });
  it("unknown role denied", async () => {
    await denied(StudentService.getAuthorizedStudentProfile({ userId: "x", role: "superuser", schoolId: SA }, SD));
  });
});
