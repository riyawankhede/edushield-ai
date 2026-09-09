/**
 * Service authorization: teacher scope.
 */
import { StudentService } from "@/services/student.service";
import { TeacherService } from "@/services/teacher.service";
import { Student } from "@/models";
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
const tsvc = TeacherService as unknown as { resolveTeacherByUserId: jest.Mock; getAssignedScope: jest.Mock };
const MStudent = Student as unknown as { findOne: jest.Mock };
const SA = "64a1b2c3d4e5f6a7b8c9d0e0";
const SD = "64a1b2c3d4e5f6a7b8c9d0f3";
const OS = "64a1b2c3d4e5f6a7b8c9d0ff";
const FS = "64a1b2c3d4e5f6a7b8c9d0fe";
const CA = "64a1b2c3d4e5f6a7b8c9d0f2";
const CB = "64a1b2c3d4e5f6a7b8c9d0bb";
const TU = "64a1b2c3d4e5f6a7b8c9d0e4";
const TD = "64a1b2c3d4e5f6a7b8c9d0d4";
const PROF = { _id: SD, firstName: "Aarav", schoolId: SA, classId: CA, isActive: true };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => ({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(v) }), lean: jest.fn().mockResolvedValue(v) });
async function denied(p: Promise<unknown>) { await expect(p).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 }); }
beforeEach(() => { jest.clearAllMocks(); });
describe("teacher role scope", () => {
  it("assigned-class student allowed", async () => {
    const { Class } = jest.requireMock("@/models") as { Class: { findOne: jest.Mock } };
    tsvc.resolveTeacherByUserId.mockResolvedValue({ _id: TD, schoolId: SA });
    tsvc.getAssignedScope.mockResolvedValue({ classIds: [CA] });
    MStudent.findOne.mockReturnValueOnce(one(PROF)).mockReturnValueOnce(one(PROF));
    Class.findOne.mockReturnValue(one({ _id: CA }));
    const out = await StudentService.getAuthorizedStudentProfile({ userId: TU, role: "teacher", schoolId: SA }, SD);
    expect(out).toMatchObject({ firstName: "Aarav" });
    expect(tsvc.resolveTeacherByUserId).toHaveBeenCalledWith(TU, SA);
  });
  it("unassigned-class student denied", async () => {
    tsvc.resolveTeacherByUserId.mockResolvedValue({ _id: TD, schoolId: SA });
    tsvc.getAssignedScope.mockResolvedValue({ classIds: [CB] });
    MStudent.findOne.mockReturnValue(one(null));
    await denied(StudentService.getAuthorizedStudentProfile({ userId: TU, role: "teacher", schoolId: SA }, OS));
  });
  it("other-school student denied", async () => {
    tsvc.resolveTeacherByUserId.mockResolvedValue({ _id: TD, schoolId: SA });
    tsvc.getAssignedScope.mockResolvedValue({ classIds: [CA] });
    MStudent.findOne.mockReturnValue(one(null));
    await denied(StudentService.getAuthorizedStudentProfile({ userId: TU, role: "teacher", schoolId: SA }, FS));
    expect(tsvc.resolveTeacherByUserId).toHaveBeenCalledWith(TU, SA);
  });
  it("unknown teacher profile denied", async () => {
    tsvc.resolveTeacherByUserId.mockResolvedValue(null);
    await denied(StudentService.getAuthorizedStudentProfile({ userId: TU, role: "teacher", schoolId: SA }, SD));
    expect(MStudent.findOne).not.toHaveBeenCalled();
  });
});
