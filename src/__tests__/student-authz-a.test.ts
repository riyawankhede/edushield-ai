/**
 * Service authorization matrix for getAuthorizedStudentProfile.
 * Part B: student + parent scopes.
 */
import { StudentService } from "@/services/student.service";
import { TeacherService } from "@/services/teacher.service";
import { Student, Parent, ParentStudentRelationship } from "@/models";

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

const tsvc = TeacherService as unknown as {
  resolveTeacherByUserId: jest.Mock;
  getAssignedScope: jest.Mock;
};
const MStudent = Student as unknown as { findOne: jest.Mock };
const MParent = Parent as unknown as { findOne: jest.Mock };
const MRel = ParentStudentRelationship as unknown as { findOne: jest.Mock };

const SA = "64a1b2c3d4e5f6a7b8c9d0e0";
const SD = "64a1b2c3d4e5f6a7b8c9d0f3";
const OS = "64a1b2c3d4e5f6a7b8c9d0ff";
const FS = "64a1b2c3d4e5f6a7b8c9d0fe";
const CA = "64a1b2c3d4e5f6a7b8c9d0f2";
const SU = "64a1b2c3d4e5f6a7b8c9d0e1";
const PU = "64a1b2c3d4e5f6a7b8c9d0e2";
const PDID = "64a1b2c3d4e5f6a7b8c9d0d1";
const PROF = { _id: SD, firstName: "Aarav", schoolId: SA, classId: CA, isActive: true };

// chainable mock: supports .select("_id").lean() and direct .lean()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (v: any) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(v) }),
  lean: jest.fn().mockResolvedValue(v),
});

async function denied(p: Promise<unknown>) {
  await expect(p).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
}

beforeEach(() => {
  jest.clearAllMocks();
  void tsvc;
});

describe("student role scope", () => {
  it("own profile allowed", async () => {
    const { Class } = jest.requireMock("@/models") as { Class: { findOne: jest.Mock } };
    MStudent.findOne
      .mockReturnValueOnce(one({ _id: { toString: () => SD } }))
      .mockReturnValueOnce(one(PROF));
    Class.findOne.mockReturnValue(one({ _id: CA }));
    const out = await StudentService.getAuthorizedStudentProfile(
      { userId: SU, role: "student", schoolId: SA },
      SD
    );
    expect(out).toMatchObject({ firstName: "Aarav" });
    expect(MStudent.findOne).toHaveBeenCalledWith({ userId: SU, schoolId: SA, isActive: true });
  });

  it("other student denied", async () => {
    MStudent.findOne.mockReturnValue(one({ _id: { toString: () => SD } }));
    await denied(
      StudentService.getAuthorizedStudentProfile(
        { userId: SU, role: "student", schoolId: SA },
        OS
      )
    );
  });

  it("other-school student denied", async () => {
    MStudent.findOne.mockReturnValue(one(null));
    await denied(
      StudentService.getAuthorizedStudentProfile(
        { userId: SU, role: "student", schoolId: SA },
        FS
      )
    );
  });
});

describe("parent role scope", () => {
  it("linked child allowed", async () => {
    const { Class } = jest.requireMock("@/models") as { Class: { findOne: jest.Mock } };
    MParent.findOne.mockReturnValue(one({ _id: PDID }));
    MRel.findOne.mockReturnValue(one({ _id: "rel1" }));
    MStudent.findOne.mockReturnValue(one(PROF));
    Class.findOne.mockReturnValue(one({ _id: CA }));
    const out = await StudentService.getAuthorizedStudentProfile(
      { userId: PU, role: "parent", schoolId: SA },
      SD
    );
    expect(out).toMatchObject({ firstName: "Aarav" });
    expect(MRel.findOne).toHaveBeenCalledWith({ parentId: PDID, studentId: SD, schoolId: SA });
  });

  it("unrelated student denied", async () => {
    MParent.findOne.mockReturnValue(one({ _id: PDID }));
    MRel.findOne.mockReturnValue(one(null));
    await denied(
      StudentService.getAuthorizedStudentProfile(
        { userId: PU, role: "parent", schoolId: SA },
        OS
      )
    );
  });

  it("other-school student denied", async () => {
    MParent.findOne.mockReturnValue(one({ _id: PDID }));
    MRel.findOne.mockReturnValue(one(null));
    await denied(
      StudentService.getAuthorizedStudentProfile(
        { userId: PU, role: "parent", schoolId: SA },
        FS
      )
    );
  });
});
