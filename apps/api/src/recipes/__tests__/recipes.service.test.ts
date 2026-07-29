import { describe, expect, it, jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";

import { Recipe } from "../models/recipe.model";
import { RecipesService } from "../recipes.service";

describe("RecipesService", () => {
  const mockModel = {
    find: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const createService = async (): Promise<RecipesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: getModelToken(Recipe.name), useValue: mockModel },
      ],
    }).compile();

    return moduleRef.get(RecipesService);
  };

  it("returns recipes sorted by newest first", async () => {
    const recipes = [{ title: "蛋炒飯" }];
    mockModel.find.mockReturnValue({
      sort: () => ({ exec: () => Promise.resolve(recipes) }),
    });

    const service = await createService();
    await expect(service.findAll()).resolves.toEqual(recipes);
  });

  it("throws NotFoundException for a missing recipe", async () => {
    mockModel.findById.mockReturnValue({
      exec: () => Promise.resolve(null),
    });

    const service = await createService();
    await expect(service.findById("missing-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
