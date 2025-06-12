var express = require("express");
var router = express.Router();
const DButils = require("./utils/DButils");
const user_utils = require("./utils/user_utils");
const recipes_utils = require("./utils/recipes_utils");

/**
 * Authenticate all incoming requests by middleware
 */
router.use(async function (req, res, next) {
  if (req.session && req.session.user_id) {
    DButils.execQuery("SELECT user_id FROM users").then((users) => {
      if (users.find((x) => x.user_id === req.session.user_id)) {
        req.user_id = req.session.user_id;
        next();
      }
    }).catch(err => next(err));
  } else {
    res.sendStatus(401);
  }
});


/**
 * This path gets body with recipeId and save this recipe in the favorites list of the logged-in user
 */
router.post("/favorites", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipe_id = req.body.recipeId;
    const source = req.body.source;
    await user_utils.markAsFavorite(user_id, recipe_id, source);
    res.status(200).send("The Recipe successfully saved as favorite");
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns the full details of a favorite recipe by its ID and source
 * e.g., GET /favorites/api/715538 or /favorites/user/123
 */
router.get("/:source/:recipe_id", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const { source, recipe_id } = req.params;
    console.log("recipe_id from params:", recipe_id);

    let recipe;

    if (source === "api") {
      recipe = await recipes_utils.getAllRecipeDetails(recipe_id);
    } else if (source === "user") {
      recipe = await recipes_utils.getAllUserFullRecipe(recipe_id, user_id);
    } else if (source === "family") {
      recipe = await recipes_utils.getAllFamilyFullRecipe(recipe_id, user_id);
    } else {
      throw { status: 400, message: "Invalid source" };
    }

      await recipes_utils.addRecipeView(user_id, 
      recipe_id,
      source
    );

    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
});

/**
 * This path returns the favorites recipes that were saved by the logged-in user
 */
router.get("/favorites", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    console.log("user_id = ",user_id);
    const favorites = await user_utils.getFavoriteRecipes(user_id);

    const api_recipes_ids = favorites
      .filter((r) => r.source === "api")
      .map((r) => r.recipe_id);
    const user_recipes_ids = favorites
      .filter((r) => r.source === "user")
      .map((r) => r.recipe_id);
    const family_recipes_ids = favorites
      .filter((r) => r.source === "family")
      .map((r) => r.recipe_id);

    let api_recipes = [];
    let user_recipes = [];
    let family_recipes = [];

    if (api_recipes_ids.length > 0) {
        api_recipes = await Promise.all(api_recipes_ids.map((id) => recipes_utils.getRecipeDetails(id))
  );
    }

    if (user_recipes_ids.length > 0) {
      user_recipes = await Promise.all(
        user_recipes_ids.map((id) => recipes_utils.getUserRecipePreview(id, user_id))
  );    
    }
    if (family_recipes_ids.length > 0) {
      family_recipes = await Promise.all(
        family_recipes_ids.map((id) => recipes_utils.getAllFamilyPreviewRecipes(id, user_id))
  );    
}


    const all_recipes = [...api_recipes, ...user_recipes, ...family_recipes];

    res.status(200).send(all_recipes);

  } catch (error) {
    next(error);
  }
});

router.post("/user_recipes", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    await recipes_utils.addUserRecipe(user_id, req.body);

    res.status(201).send({ message: "Recipe added successfully" });
  } catch (error) {
    console.error("Error adding user recipe:", error);
    next(error);
  }
});

router.get("/user_recipes", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipes = await recipes_utils.getAllUserPreviewRecipes(user_id);

    res.status(200).send(recipes);
  } catch (error) {
    console.error("Error fetching user recipes preview:", error);
    next(error);
  }
});

router.post("/family_recipes", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    await recipes_utils.addFamilyRecipe(user_id, req.body);

    res.status(201).send({ message: "Family recipe added successfully" });
  } catch (error) {
    console.error("Error adding family recipe:", error);
    next(error);
  }
});

router.get("/family_recipes", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const recipes = await recipes_utils.getAllFamilyPreviewRecipes(user_id);

    res.status(200).send(recipes);
  } catch (error) {
    console.error("Error fetching family recipe previews:", error);
    next(error);
  }
});

router.get("/last-viewed", async (req, res, next) => {
  try {
    const user_id = req.session.user_id;
    const result = await recipes_utils.getLastViewedRecipes(user_id);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
});



module.exports = router;

