import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, keccak256, toBytes, zeroAddress } from "viem";

describe("CampusRoles", async function () {
    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();

    const NO_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

    async function deploy() {
        const campusRoles = await viem.deployContract("CampusRoles");
        const [admin, user1, user2, user3, outsider] = await viem.getWalletClients();

        const adminRole = await campusRoles.read.DEFAULT_ADMIN_ROLE();
        const librarianRole = await campusRoles.read.LIBRARIAN_ROLE();
        const professorRole = await campusRoles.read.PROFESSOR_ROLE();
        const studentRole = await campusRoles.read.STUDENT_ROLE();

        return {
            campusRoles,
            admin,
            user1,
            user2,
            user3,
            outsider,
            adminRole,
            librarianRole,
            professorRole,
            studentRole,
        };
    }

    describe("Deployment", function () {
        it("Should set deployer as admin", async function () {
            const { campusRoles, admin, adminRole } = await deploy();

            assert.equal(
                await campusRoles.read.hasRole([adminRole, admin.account.address]),
                true,
            );
        });

        it("Should report deployer as admin via isAdmin", async function () {
            const { campusRoles, admin } = await deploy();

            assert.equal(
                await campusRoles.read.isAdmin([admin.account.address]),
                true,
            );
        });

        it("Should not assign student/librarian/professor roles to deployer", async function () {
            const { campusRoles, admin } = await deploy();

            assert.equal(await campusRoles.read.isStudent([admin.account.address]), false);
            assert.equal(await campusRoles.read.isLibrarian([admin.account.address]), false);
            assert.equal(await campusRoles.read.isProfessor([admin.account.address]), false);
        });
    });

    describe("registerUser", function () {
        it("Should register a student and expose full user info", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
            assert.equal(await campusRoles.read.isRegistered([user1.account.address]), true);

            const [name, role, registered] = await campusRoles.read.getUserInfo([user1.account.address]);
            assert.equal(name, "Alice");
            assert.equal(role, studentRole);
            assert.equal(registered, true);
        });

        it("Should register a librarian correctly", async function () {
            const { campusRoles, user1, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Bob",
                librarianRole,
            ]);

            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user1.account.address]), false);
        });

        it("Should register a professor correctly", async function () {
            const { campusRoles, user1, professorRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Prof",
                professorRole,
            ]);

            assert.equal(await campusRoles.read.isProfessor([user1.account.address]), true);
        });

        it("Should allow registering a user with ADMIN role", async function () {
            const { campusRoles, user1, adminRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Admin2",
                adminRole,
            ]);

            assert.equal(await campusRoles.read.isAdmin([user1.account.address]), true);
            // DEFAULT_ADMIN_ROLE == bytes32(0), same sentinel used by isRegistered/getUserRole.
            assert.equal(await campusRoles.read.isRegistered([user1.account.address]), false);
        });

        it("Should store role in user record", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            assert.equal(await campusRoles.read.getUserRole([user1.account.address]), studentRole);
        });

        it("Should emit UserRegistered event", async function () {
            const { campusRoles, user1, studentRole } = await deploy();
            const fromBlock = await publicClient.getBlockNumber();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            const events = await publicClient.getContractEvents({
                address: campusRoles.address,
                abi: campusRoles.abi,
                eventName: "UserRegistered",
                fromBlock,
                strict: true,
            });

            assert.equal(events.length, 1);
            assert.equal(getAddress(events[0].args.user), getAddress(user1.account.address));
            assert.equal(events[0].args.userData.name, "Alice");
            assert.equal(events[0].args.userData.role, studentRole);
        });

        it("Should revert when registering with zero address", async function () {
            const { campusRoles, studentRole } = await deploy();

            await assert.rejects(async () => {
                await campusRoles.write.registerUser([zeroAddress, "Zero", studentRole]);
            });
        });

        it("Should revert when role is invalid", async function () {
            const { campusRoles, user1 } = await deploy();
            const invalidRole = keccak256(toBytes("INVALID_ROLE"));

            await assert.rejects(async () => {
                await campusRoles.write.registerUser([
                    user1.account.address,
                    "Alice",
                    invalidRole,
                ]);
            });
        });

        it("Should revert for duplicate registrations", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await assert.rejects(async () => {
                await campusRoles.write.registerUser([
                    user1.account.address,
                    "Alice 2",
                    studentRole,
                ]);
            });
        });

        it("Should revert if called by non-admin", async function () {
            const { campusRoles, outsider, user1, studentRole } = await deploy();

            await assert.rejects(async () => {
                await campusRoles.write.registerUser(
                    [user1.account.address, "Alice", studentRole],
                    { account: outsider.account },
                );
            });
        });

        it("Should enforce one functional role only", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), false);
            assert.equal(await campusRoles.read.isProfessor([user1.account.address]), false);
            assert.equal(await campusRoles.read.isAdmin([user1.account.address]), false);
        });
    });

    describe("removeUser", function () {
        it("Should remove user and clear registration data", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await campusRoles.write.removeUser([user1.account.address]);

            assert.equal(await campusRoles.read.isRegistered([user1.account.address]), false);
            assert.equal(await campusRoles.read.isStudent([user1.account.address]), false);
            assert.equal(await campusRoles.read.getUserRole([user1.account.address]), NO_ROLE);

            const [name, role, registered] = await campusRoles.read.getUserInfo([user1.account.address]);
            assert.equal(name, "");
            assert.equal(role, NO_ROLE);
            assert.equal(registered, false);
        });

        it("Should emit UserRemoved event", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            const fromBlock = await publicClient.getBlockNumber();
            await campusRoles.write.removeUser([user1.account.address]);

            const events = await publicClient.getContractEvents({
                address: campusRoles.address,
                abi: campusRoles.abi,
                eventName: "UserRemoved",
                fromBlock,
                strict: true,
            });

            assert.equal(events.length, 1);
            assert.equal(getAddress(events[0].args.user), getAddress(user1.account.address));
            assert.equal(events[0].args.previousData.name, "Alice");
            assert.equal(events[0].args.previousData.role, studentRole);
        });

        it("Should revert when removing an unregistered user", async function () {
            const { campusRoles, user2 } = await deploy();

            await assert.rejects(async () => {
                await campusRoles.write.removeUser([user2.account.address]);
            });
        });

        it("Should revert removeUser if caller is non-admin", async function () {
            const { campusRoles, user1, outsider, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await assert.rejects(async () => {
                await campusRoles.write.removeUser([user1.account.address], {
                    account: outsider.account,
                });
            });
        });

        it("Should allow re-registering the same user after removal", async function () {
            const { campusRoles, user1, studentRole, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);
            await campusRoles.write.removeUser([user1.account.address]);
            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice Librarian",
                librarianRole,
            ]);

            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user1.account.address]), false);
        });

        it("Should revert removeUser for zero address", async function () {
            const { campusRoles } = await deploy();

            await assert.rejects(async () => {
                await campusRoles.write.removeUser([zeroAddress]);
            });
        });
    });

    describe("changeRole", function () {
        it("Should change user role and keep exactly one active role", async function () {
            const { campusRoles, user1, studentRole, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await campusRoles.write.changeRole([user1.account.address, librarianRole]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), false);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), true);
            assert.equal(await campusRoles.read.getUserRole([user1.account.address]), librarianRole);
        });

        it("Should emit UserRoleChanged event", async function () {
            const { campusRoles, user1, studentRole, professorRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            const fromBlock = await publicClient.getBlockNumber();
            await campusRoles.write.changeRole([user1.account.address, professorRole]);

            const events = await publicClient.getContractEvents({
                address: campusRoles.address,
                abi: campusRoles.abi,
                eventName: "UserRoleChanged",
                fromBlock,
                strict: true,
            });

            assert.equal(events.length, 1);
            assert.equal(getAddress(events[0].args.user), getAddress(user1.account.address));
            assert.equal(events[0].args.oldRole, studentRole);
            assert.equal(events[0].args.newRole, professorRole);
            assert.equal(events[0].args.userData.role, professorRole);
        });

        it("Should revoke old role and grant new role", async function () {
            const { campusRoles, user1, studentRole, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await campusRoles.write.changeRole([user1.account.address, librarianRole]);

            assert.equal(
                await campusRoles.read.hasRole([studentRole, user1.account.address]),
                false,
            );
            assert.equal(
                await campusRoles.read.hasRole([librarianRole, user1.account.address]),
                true,
            );
        });

        it("Should revert changeRole when user is not registered", async function () {
            const { campusRoles, user2, studentRole } = await deploy();

            await assert.rejects(async () => {
                await campusRoles.write.changeRole([user2.account.address, studentRole]);
            });
        });

        it("Should revert changeRole for invalid role", async function () {
            const { campusRoles, user1, studentRole } = await deploy();
            const invalidRole = keccak256(toBytes("FAKE"));

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await assert.rejects(async () => {
                await campusRoles.write.changeRole([user1.account.address, invalidRole]);
            });
        });

        it("Should revert changeRole if caller is non-admin", async function () {
            const { campusRoles, user1, outsider, studentRole, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            await assert.rejects(async () => {
                await campusRoles.write.changeRole([user1.account.address, librarianRole], {
                    account: outsider.account,
                });
            });
        });

        it("Should allow changing to the same role (idempotent)", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);
            await campusRoles.write.changeRole([user1.account.address, studentRole]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
        });

        it("Should keep isolation between multiple registered users", async function () {
            const { campusRoles, user1, user2, user3, studentRole, librarianRole, professorRole } = await deploy();

            await campusRoles.write.registerUser([user1.account.address, "Student", studentRole]);
            await campusRoles.write.registerUser([user2.account.address, "Librarian", librarianRole]);
            await campusRoles.write.registerUser([user3.account.address, "Professor", professorRole]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), false);

            assert.equal(await campusRoles.read.isLibrarian([user2.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user2.account.address]), false);

            assert.equal(await campusRoles.read.isProfessor([user3.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user3.account.address]), false);
        });
    });

    describe("View helpers", function () {
        it("Should return false for unregistered user", async function () {
            const { campusRoles, outsider } = await deploy();

            assert.equal(await campusRoles.read.isRegistered([outsider.account.address]), false);
            assert.equal(await campusRoles.read.isStudent([outsider.account.address]), false);
        });

        it("Should return correct info for registered user", async function () {
            const { campusRoles, user1, studentRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "TestUser",
                studentRole,
            ]);

            const [name, role, registered] = await campusRoles.read.getUserInfo([user1.account.address]);
            assert.equal(name, "TestUser");
            assert.equal(role, studentRole);
            assert.equal(registered, true);
        });

        it("Should return NO_ROLE for unregistered users", async function () {
            const { campusRoles, outsider } = await deploy();

            assert.equal(await campusRoles.read.getUserRole([outsider.account.address]), NO_ROLE);
            assert.equal(await campusRoles.read.isRegistered([outsider.account.address]), false);
        });

        it("Should report admin as not registered user by default", async function () {
            const { campusRoles, admin } = await deploy();

            assert.equal(await campusRoles.read.isAdmin([admin.account.address]), true);
            assert.equal(await campusRoles.read.isRegistered([admin.account.address]), false);
        });
    });

    describe("Single role enforcement", function () {
        it("User should only have one role at a time", async function () {
            const { campusRoles, user1, studentRole, librarianRole } = await deploy();

            await campusRoles.write.registerUser([
                user1.account.address,
                "Alice",
                studentRole,
            ]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), false);
            assert.equal(await campusRoles.read.isProfessor([user1.account.address]), false);
            assert.equal(await campusRoles.read.isAdmin([user1.account.address]), false);

            await campusRoles.write.changeRole([user1.account.address, librarianRole]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), false);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), true);
            assert.equal(await campusRoles.read.isProfessor([user1.account.address]), false);
            assert.equal(await campusRoles.read.isAdmin([user1.account.address]), false);
        });

        it("Each user in the system has exactly one role", async function () {
            const { campusRoles, user1, user2, user3, studentRole, librarianRole, professorRole } = await deploy();

            await campusRoles.write.registerUser([user1.account.address, "Student", studentRole]);
            await campusRoles.write.registerUser([user2.account.address, "Librarian", librarianRole]);
            await campusRoles.write.registerUser([user3.account.address, "Professor", professorRole]);

            assert.equal(await campusRoles.read.isStudent([user1.account.address]), true);
            assert.equal(await campusRoles.read.isLibrarian([user1.account.address]), false);

            assert.equal(await campusRoles.read.isLibrarian([user2.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user2.account.address]), false);

            assert.equal(await campusRoles.read.isProfessor([user3.account.address]), true);
            assert.equal(await campusRoles.read.isStudent([user3.account.address]), false);
        });
    });
});